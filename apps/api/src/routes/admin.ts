import { Hono } from 'hono'
import {
  listPlatformWorkflowDesigns,
  listCompanies,
  listPlatformUsers,
  getPlatformUserById,
  createPlatformUser,
  updatePlatformUser,
  deletePlatformUser,
  type PlatformUserRecord,
} from 'db/platform'
import {
  listAdminUserGroups,
  getAdminUserGroupById,
  createAdminUserGroup,
  updateAdminUserGroup,
  deleteAdminUserGroup,
  listAdminUserGroupMemberships,
  setAdminUserGroupMemberships,
} from 'db/admin-user-groups'
import { listLatestHealthChecks, listHealthCheckHistoryForService, type HealthCheckService } from 'db/health-checks'
import { hashPassword } from 'shared/server'
import { RESOURCE_CATALOG } from 'shared'
import { adminAuth } from '../middleware/admin.js'
import { requireAdminPermission, resolveAdminPermissions } from '../middleware/admin-permission.js'
import type { AdminScope } from '../types.js'

const DEFAULT_LIMIT = 20
const VALID_SERVICES: HealthCheckService[] = ['surrealdb', 'restate', 'workflow-runtime', 'api']

const app = new Hono()
app.use(adminAuth())

  // Health checks
app.get('/health-checks', requireAdminPermission('platform', 'view'), async (c) => {
    const latest = await listLatestHealthChecks()
    return c.json({ latest })
  })

app.get('/health-checks/history', requireAdminPermission('platform', 'view'), async (c) => {
    const service = c.req.query('service')
    if (typeof service !== 'string' || !VALID_SERVICES.includes(service as HealthCheckService)) {
      return c.json({ error: 'Missing or invalid service query parameter' }, 400)
    }

    const limit = parseInt(String(c.req.query('limit') ?? DEFAULT_LIMIT), 10)
    if (!Number.isFinite(limit) || limit <= 0 || Number.isNaN(limit)) {
      return c.json({ error: 'Invalid limit query parameter' }, 400)
    }

    const history = await listHealthCheckHistoryForService(service as HealthCheckService, limit)
    return c.json({
      service: service as HealthCheckService,
      limit,
      history,
    })
  })

  // Dashboard
app.get('/dashboard', requireAdminPermission('platform', 'view'), async (c) => {
    const [companies, workflowDesigns] = await Promise.all([
      listCompanies(),
      listPlatformWorkflowDesigns(),
    ])
    const triggers = workflowDesigns.reduce(
      (sum, d) => sum + (d.starts?.filter((s) => s.type === 'db_trigger').length ?? 0),
      0
    )
    return c.json({
      companies: companies.length,
      workflowDesigns: workflowDesigns.length,
      triggers,
    })
  })

  // Platform users
  function serializeUser(user: PlatformUserRecord) {
    const { password: _, ...rest } = user
    return rest
  }

app.get('/platform-users', requireAdminPermission('admin_user', 'view'), async (c) => {
    const users = await listPlatformUsers()
    const withGroups = await Promise.all(
      users.map(async (user) => ({
        ...serializeUser(user),
        groups: await listAdminUserGroupMemberships(user.id),
      }))
    )
    return c.json(withGroups)
  })

app.get('/platform-users/:id', requireAdminPermission('admin_user', 'view'), async (c) => {
    const user = await getPlatformUserById(c.req.param('id'))
    if (!user) return c.json({ error: 'Not found' }, 404)
    const groups = await listAdminUserGroupMemberships(user.id)
    return c.json({ ...serializeUser(user), groups })
  })

app.post('/platform-users', requireAdminPermission('admin_user', 'create'), async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const groupIds = Array.isArray(body.groupIds) ? body.groupIds.filter((id): id is string => typeof id === 'string') : []

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400)
    }

    const hashed = await hashPassword(password)
    const user = await createPlatformUser({ email, password: hashed })
    if (groupIds.length) {
      await setAdminUserGroupMemberships(user.id, groupIds)
    }
    const groups = await listAdminUserGroupMemberships(user.id)
    return c.json({ ...serializeUser(user), groups }, 201)
  })

app.patch('/platform-users/:id', requireAdminPermission('admin_user', 'edit'), async (c) => {
    const id = c.req.param('id')
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    const update: { email?: string; password?: string } = {}
    if (typeof body.email === 'string') update.email = body.email.trim()
    if (typeof body.password === 'string' && body.password.length > 0) {
      update.password = await hashPassword(body.password)
    }

    const user = await updatePlatformUser(id, update)
    if (!user) return c.json({ error: 'Not found' }, 404)

    if (Array.isArray(body.groupIds)) {
      const groupIds = body.groupIds.filter((id): id is string => typeof id === 'string')
      await setAdminUserGroupMemberships(id, groupIds)
    }

    const groups = await listAdminUserGroupMemberships(user.id)
    return c.json({ ...serializeUser(user), groups })
  })

app.delete('/platform-users/:id', requireAdminPermission('admin_user', 'delete'), async (c) => {
    const id = c.req.param('id')
    const user = await getPlatformUserById(id)
    if (!user) return c.json({ error: 'Not found' }, 404)
    await deletePlatformUser(id)
    return c.json({ ok: true })
  })

  // Admin user groups
app.get('/admin-user-groups', requireAdminPermission('admin_user_group', 'view'), async (c) => {
    return c.json(await listAdminUserGroups())
  })

app.get('/admin-user-groups/:id', requireAdminPermission('admin_user_group', 'view'), async (c) => {
    const group = await getAdminUserGroupById(c.req.param('id'))
    if (!group) return c.json({ error: 'Not found' }, 404)
    return c.json(group)
  })

app.post('/admin-user-groups', requireAdminPermission('admin_user_group', 'create'), async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return c.json({ error: 'Name is required' }, 400)
    const group = await createAdminUserGroup({
      name,
      description: typeof body.description === 'string' ? body.description : undefined,
    })
    return c.json(group, 201)
  })

app.patch('/admin-user-groups/:id', requireAdminPermission('admin_user_group', 'edit_info'), async (c) => {
    const id = c.req.param('id')
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    const update: { name?: string; description?: string } = {}
    if (typeof body.name === 'string') update.name = body.name.trim()
    if (typeof body.description === 'string') update.description = body.description
    const group = await updateAdminUserGroup(id, update)
    if (!group) return c.json({ error: 'Not found' }, 404)
    return c.json(group)
  })

app.delete('/admin-user-groups/:id', requireAdminPermission('admin_user_group', 'delete'), async (c) => {
    await deleteAdminUserGroup(c.req.param('id'))
    return c.json({ ok: true })
  })

app.get('/permissions/effective', requireAdminPermission('platform', 'view'), async (c) => {
    const scope = c.get('scope') as AdminScope
    const resourceType = c.req.query('resourceType')
    const recordId = c.req.query('recordId') ?? undefined
    if (!resourceType || !(resourceType in RESOURCE_CATALOG)) {
      return c.json({ error: 'Invalid resourceType' }, 400)
    }
    const def = RESOURCE_CATALOG[resourceType as keyof typeof RESOURCE_CATALOG]
    const mask = await resolveAdminPermissions(scope, def.name, recordId)
    return c.json({ resourceType, recordId, bitmask: mask })
  })

export const adminRoutes = app
