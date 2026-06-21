import { Hono } from 'hono'
import {
  deleteView,
  generateDefaultView,
  getDefaultView,
  getTableSchema,
  getView,
  listViews,
  upsertView,
  type ViewInput,
} from 'db/schema-registry'
import { tenantAuth } from '../middleware/tenant.js'
import { adminAuth } from '../middleware/admin.js'
import type { AdminScope, ApiScope, TenantScope } from '../types.js'

function getScope(c: { get: (key: 'scope') => ApiScope }): ApiScope {
  return c.get('scope')
}

function tenantViewsRouter() {
  const r = new Hono()
  r.use(tenantAuth)

  r.get('/default/:table', async (c) => {
    const scope = getScope(c) as TenantScope
    const table = c.req.param('table')
    const [view, schema] = await Promise.all([
      getDefaultView(scope.namespace, scope.database, table),
      getTableSchema(scope.namespace, scope.database, table),
    ])
    if (!view) {
      return c.json({ error: 'Default view not found' }, 404)
    }
    return c.json({ view, schema })
  })

  r.get('/:id', async (c) => {
    const scope = getScope(c) as TenantScope
    const id = c.req.param('id')
    const view = await getView(scope.namespace, scope.database, id)
    if (!view) {
      return c.json({ error: 'View not found' }, 404)
    }
    const schema = await getTableSchema(scope.namespace, scope.database, view.table)
    return c.json({ view, schema })
  })

  r.get('/', async (c) => {
    const scope = getScope(c) as TenantScope
    const table = c.req.query('table')
    return c.json(await listViews(scope.namespace, scope.database, table))
  })

  r.post('/', async (c) => {
    const scope = getScope(c) as TenantScope
    const body = await c.req.json<ViewInput>()
    return c.json(await upsertView(scope.namespace, scope.database, body), 201)
  })

  r.patch('/:id', async (c) => {
    const scope = getScope(c) as TenantScope
    const id = c.req.param('id')
    const body = await c.req.json<Partial<ViewInput>>()
    const input: ViewInput = {
      ...body,
      id,
    }
    return c.json(await upsertView(scope.namespace, scope.database, input))
  })

  r.delete('/:id', async (c) => {
    const scope = getScope(c) as TenantScope
    const id = c.req.param('id')
    return c.json(await deleteView(scope.namespace, scope.database, id))
  })

  return r
}

function adminViewsRouter() {
  const r = new Hono()
  r.use(adminAuth('nsdb'))

  r.get('/default/:table', async (c) => {
    const scope = getScope(c) as AdminScope
    const table = c.req.param('table')
    const [view, schema] = await Promise.all([
      getDefaultView(scope.namespace, scope.database, table),
      getTableSchema(scope.namespace, scope.database, table),
    ])
    if (!view) {
      return c.json({ error: 'Default view not found' }, 404)
    }
    return c.json({ view, schema })
  })

  r.get('/:id', async (c) => {
    const scope = getScope(c) as AdminScope
    const id = c.req.param('id')
    const view = await getView(scope.namespace, scope.database, id)
    if (!view) {
      return c.json({ error: 'View not found' }, 404)
    }
    const schema = await getTableSchema(scope.namespace, scope.database, view.table)
    return c.json({ view, schema })
  })

  r.get('/', async (c) => {
    const scope = getScope(c) as AdminScope
    const table = c.req.query('table')
    return c.json(await listViews(scope.namespace, scope.database, table))
  })

  r.post('/', async (c) => {
    const scope = getScope(c) as AdminScope
    const body = await c.req.json<ViewInput>()
    return c.json(await upsertView(scope.namespace, scope.database, body), 201)
  })

  r.patch('/:id', async (c) => {
    const scope = getScope(c) as AdminScope
    const id = c.req.param('id')
    const body = await c.req.json<Partial<ViewInput>>()
    const input: ViewInput = {
      ...body,
      id,
    }
    return c.json(await upsertView(scope.namespace, scope.database, input))
  })

  r.delete('/:id', async (c) => {
    const scope = getScope(c) as AdminScope
    const id = c.req.param('id')
    return c.json(await deleteView(scope.namespace, scope.database, id))
  })

  return r
}

const app = new Hono()
app.route('/views', tenantViewsRouter())
app.route('/admin/views/:nsdb', adminViewsRouter())
export const viewsRoutes = app
