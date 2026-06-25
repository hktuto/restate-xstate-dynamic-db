import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { getResourceType, listResourceTypes } from 'db/resource-types'
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

  r.get('/', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    return c.json(await listResourceTypes(scope.namespace, scope.database))
  })

  r.get('/:name', async (c) => {
    const scope = c.get('scope') as Scope
    if (scope.type !== scopeType) return c.json({ error: 'Forbidden' }, 403)
    const name = c.req.param('name')
    const resourceType = await getResourceType(scope.namespace, scope.database, name)
    if (!resourceType) {
      return c.json({ error: `Resource type not found: ${name}` }, 404)
    }
    return c.json(resourceType)
  })

  return r
}

const app = new Hono()
app.route('/resource-types', makeRouter(tenantAuth, 'tenant'))
app.route('/admin/resource-types/:nsdb', makeRouter(adminAuth('nsdb'), 'admin'))
export const resourceTypesRoutes = app
