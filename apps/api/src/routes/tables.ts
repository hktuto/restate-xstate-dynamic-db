import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
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
import type { AdminScope, TenantScope } from '../types.js'
import { buildTableQuery, type QueryBody } from './table-query-builder.js'

async function runTableQuery(namespace: string, database: string, table: string, body: QueryBody) {
  const surreal = await getSurreal(namespace, database)
  try {
    const schema = await getTableSchema(namespace, database, table)
    const columnNames = new Set(schema?.columns.map((c: { name: string }) => c.name) ?? [])
    const textFields = new Set(
      schema?.columns
        .filter((c: { displayType: string; system?: boolean; hidden?: boolean }) =>
          !c.system && !c.hidden && ['text', 'email', 'url', 'richText'].includes(c.displayType))
        .map((c: { name: string }) => c.name) ?? []
    )
    const { query, vars } = buildTableQuery(table, body, columnNames, textFields, schema)
    const [records, totalResult] = await surreal.query(query, vars)
    const total = (totalResult as any[])[0]?.total ?? 0
    return { records, total }
  } finally {
    await closeSurreal(surreal)
  }
}

function makeRouter<T extends 'tenant' | 'admin'>(
  auth: MiddlewareHandler,
  scopeType: T
) {
  type Scope = T extends 'tenant' ? TenantScope : AdminScope
  const r = new Hono()
  r.use(auth)

  r.get('/', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    return c.json(await listUserTables(scope.namespace, scope.database))
  })

  r.get('/:table', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    const table = c.req.param('table')
    return c.json(await getTableSchema(scope.namespace, scope.database, table))
  })

  r.post('/:table/sync', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    const table = c.req.param('table')
    return c.json(await syncTableSchemaFromRecords(scope.namespace, scope.database, table))
  })

  r.post('/:table/query', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    const table = c.req.param('table')
    const body = await c.req.json<QueryBody>()
    return c.json(await runTableQuery(scope.namespace, scope.database, table, body))
  })

  r.post('/:table/columns', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    const table = c.req.param('table')
    const body = await c.req.json<ColumnInput>()
    return c.json(await upsertColumn(scope.namespace, scope.database, { ...body, table }))
  })

  return r
}

const app = new Hono()
app.route('/tables', makeRouter(tenantAuth, 'tenant'))
app.route('/admin/tables/:nsdb', makeRouter(adminAuth('nsdb'), 'admin'))
export const tablesRoutes = app
