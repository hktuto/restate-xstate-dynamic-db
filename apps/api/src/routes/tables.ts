import { Hono } from 'hono'
import { getSurreal, closeSurreal } from 'db/client'
import {
  getTableSchema,
  listUserTables,
  syncTableSchemaFromRecords,
  upsertColumn,
} from 'db/schema-registry'
import type { ColumnInput } from 'db/schema-registry'
import { tenantAuth } from '../middleware/tenant.js'
import { adminAuth } from '../middleware/admin.js'
import type { AdminScope, ApiScope, TenantScope } from '../types.js'

function getScope(c: { get: (key: 'scope') => ApiScope }): ApiScope {
  return c.get('scope')
}

interface QueryBody {
  page?: number
  pageSize?: number
}

async function runTableQuery(namespace: string, database: string, table: string, body: QueryBody) {
  const surreal = await getSurreal(namespace, database)
  try {
    const limit = body.pageSize ?? 25
    const start = ((body.page ?? 1) - 1) * limit
    const [records, totalResult] = await surreal.query(
      `
      SELECT * FROM ${table}
      LIMIT $limit START $start
      ;
      SELECT count() AS total FROM ${table} GROUP ALL
      `,
      { limit, start }
    )
    const total = (totalResult as any[])[0]?.total ?? 0
    return { records, total }
  } finally {
    await closeSurreal(surreal)
  }
}

function tenantTablesRouter() {
  const r = new Hono()
  r.use(tenantAuth)

  r.get('/', async (c) => {
    const scope = getScope(c) as TenantScope
    return c.json(await listUserTables(scope.namespace, scope.database))
  })

  r.get('/:table', async (c) => {
    const scope = getScope(c) as TenantScope
    const table = c.req.param('table')
    return c.json(await getTableSchema(scope.namespace, scope.database, table))
  })

  r.post('/:table/sync', async (c) => {
    const scope = getScope(c) as TenantScope
    const table = c.req.param('table')
    return c.json(await syncTableSchemaFromRecords(scope.namespace, scope.database, table))
  })

  r.post('/:table/query', async (c) => {
    const scope = getScope(c) as TenantScope
    const table = c.req.param('table')
    const body = await c.req.json<QueryBody>()
    return c.json(await runTableQuery(scope.namespace, scope.database, table, body))
  })

  r.post('/:table/columns', async (c) => {
    const scope = getScope(c) as TenantScope
    const table = c.req.param('table')
    const body = await c.req.json<ColumnInput>()
    return c.json(await upsertColumn(scope.namespace, scope.database, { ...body, table }))
  })

  return r
}

function adminTablesRouter() {
  const r = new Hono()
  r.use(adminAuth('nsdb'))

  r.get('/', async (c) => {
    const scope = getScope(c) as AdminScope
    return c.json(await listUserTables(scope.namespace, scope.database))
  })

  r.get('/:table', async (c) => {
    const scope = getScope(c) as AdminScope
    const table = c.req.param('table')
    return c.json(await getTableSchema(scope.namespace, scope.database, table))
  })

  r.post('/:table/sync', async (c) => {
    const scope = getScope(c) as AdminScope
    const table = c.req.param('table')
    return c.json(await syncTableSchemaFromRecords(scope.namespace, scope.database, table))
  })

  r.post('/:table/query', async (c) => {
    const scope = getScope(c) as AdminScope
    const table = c.req.param('table')
    const body = await c.req.json<QueryBody>()
    return c.json(await runTableQuery(scope.namespace, scope.database, table, body))
  })

  r.post('/:table/columns', async (c) => {
    const scope = getScope(c) as AdminScope
    const table = c.req.param('table')
    const body = await c.req.json<ColumnInput>()
    return c.json(await upsertColumn(scope.namespace, scope.database, { ...body, table }))
  })

  return r
}

const app = new Hono()
app.route('/tables', tenantTablesRouter())
app.route('/admin/tables/:nsdb', adminTablesRouter())
export const tablesRoutes = app
