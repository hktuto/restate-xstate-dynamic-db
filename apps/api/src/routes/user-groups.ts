import { Hono } from 'hono'
import {
  createUserGroupWithDefaults,
  listUserGroups,
  getUserGroupById,
  updateUserGroup,
  deleteUserGroup,
  addUserGroupMember,
  removeUserGroupMember,
  listUserGroupMembers,
} from 'db/user-groups'
import { tenantAuth } from '../middleware/tenant.js'
import { requirePermission } from '../middleware/permission.js'
import type { TenantScope } from '../types.js'

const app = new Hono()
app.use(tenantAuth)

app.get('/', requirePermission('user_group', 'view'), async (c) => {
    const scope = c.get('scope') as TenantScope
    return c.json(await listUserGroups(scope.namespace))
  })

app.post('/', requirePermission('user_group', 'create'), async (c) => {
    const scope = c.get('scope') as TenantScope
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    const name = body.name
    if (!name || typeof name !== 'string') {
      return c.json({ error: 'Name required' }, 400)
    }
    const group = await createUserGroupWithDefaults(
      scope.namespace,
      { name, description: typeof body.description === 'string' ? body.description : undefined },
      scope.memberId
    )
    return c.json(group)
  })

app.get('/:id', requirePermission('user_group_detail', 'view', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    const group = await getUserGroupById(scope.namespace, c.req.param('id'))
    if (!group) return c.json({ error: 'Not found' }, 404)
    return c.json(group)
  })

app.patch('/:id', requirePermission('user_group_detail', 'edit_info', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    const id = c.req.param('id')
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    const update: { name?: string; description?: string } = {}
    if (typeof body.name === 'string') update.name = body.name
    if (typeof body.description === 'string') update.description = body.description
    return c.json(await updateUserGroup(scope.namespace, id, update))
  })

app.delete('/:id', requirePermission('user_group_detail', 'delete', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    await deleteUserGroup(scope.namespace, c.req.param('id'))
    return c.json({ ok: true })
  })

app.get('/:id/members', requirePermission('user_group_detail', 'view', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    return c.json(await listUserGroupMembers(scope.namespace, c.req.param('id')))
  })

app.post('/:id/members', requirePermission('user_group_detail', 'add_member', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    const memberId = body.memberId
    if (!memberId || typeof memberId !== 'string') {
      return c.json({ error: 'memberId required' }, 400)
    }
    await addUserGroupMember(scope.namespace, memberId, c.req.param('id'))
    return c.json({ ok: true })
  })

app.delete('/:id/members/:memberId', requirePermission('user_group_detail', 'remove_member', 'id'), async (c) => {
    const scope = c.get('scope') as TenantScope
    await removeUserGroupMember(scope.namespace, c.req.param('memberId'), c.req.param('id'))
    return c.json({ ok: true })
  })

export const userGroupsRoutes = app
