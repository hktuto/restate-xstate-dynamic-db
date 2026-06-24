import { Hono } from 'hono'
import { getResourceType, listResourceTypes } from 'db/resource-types'
import { tenantAuth } from '../middleware/tenant.js'
import { adminAuth } from '../middleware/admin.js'
import type { AdminScope, ApiScope, TenantScope } from '../types.js'

function getScope(c: { get: (key: 'scope') => ApiScope }): ApiScope {
  return c.get('scope')
}

function tenantResourceTypesRouter() {
  const r = new Hono()
  r.use(tenantAuth)

  r.get('/', async (c) => {
    const scope = getScope(c) as TenantScope
    return c.json(await listResourceTypes(scope.namespace, scope.database))
  })

  r.get('/:name', async (c) => {
    const scope = getScope(c) as TenantScope
    const name = c.req.param('name')
    const resourceType = await getResourceType(scope.namespace, scope.database, name)
    if (!resourceType) {
      return c.json({ error: `Resource type not found: ${name}` }, 404)
    }
    return c.json(resourceType)
  })

  return r
}

function adminResourceTypesRouter() {
  const r = new Hono()
  r.use(adminAuth('nsdb'))

  r.get('/', async (c) => {
    const scope = getScope(c) as AdminScope
    return c.json(await listResourceTypes(scope.namespace, scope.database))
  })

  r.get('/:name', async (c) => {
    const scope = getScope(c) as AdminScope
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
app.route('/resource-types', tenantResourceTypesRouter())
app.route('/admin/resource-types/:nsdb', adminResourceTypesRouter())
export const resourceTypesRoutes = app
