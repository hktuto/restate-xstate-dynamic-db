import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
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
import type { AdminScope, TenantScope } from '../types.js'

function makeRouter<T extends 'tenant' | 'admin'>(
  auth: MiddlewareHandler,
  scopeType: T
) {
  type Scope = T extends 'tenant' ? TenantScope : AdminScope
  const r = new Hono()
  r.use(auth)

  r.get('/default/:table', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
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
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    const id = c.req.param('id')
    const view = await getView(scope.namespace, scope.database, id)
    if (!view) {
      return c.json({ error: 'View not found' }, 404)
    }
    const schema = await getTableSchema(scope.namespace, scope.database, view.table)
    return c.json({ view, schema })
  })

  r.get('/', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    const table = c.req.query('table')
    return c.json(await listViews(scope.namespace, scope.database, table))
  })

  r.post('/', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    const body = await c.req.json<ViewInput>()
    return c.json(await upsertView(scope.namespace, scope.database, body), 201)
  })

  r.patch('/:id', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    const id = c.req.param('id')
    const body = await c.req.json<Partial<ViewInput>>()
    const input: ViewInput = {
      ...body,
      id,
    }
    return c.json(await upsertView(scope.namespace, scope.database, input))
  })

  r.delete('/:id', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    const id = c.req.param('id')
    return c.json(await deleteView(scope.namespace, scope.database, id))
  })

  return r
}

const app = new Hono()
app.route('/views', makeRouter(tenantAuth, 'tenant'))
app.route('/admin/views/:nsdb', makeRouter(adminAuth('nsdb'), 'admin'))
export const viewsRoutes = app
