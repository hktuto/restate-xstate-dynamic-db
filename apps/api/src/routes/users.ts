import { Hono } from 'hono'
import { getUserProfilesByIds, updateUserProfile } from 'db/platform'
import { listMembers, createMember, updateMember, getMemberById, deleteMember } from 'db/tenant'
import { tenantAuth } from '../middleware/tenant.js'
import { dispatchTrigger } from '../lib/dispatch.js'
import type { TenantScope } from '../types.js'
import crypto from 'node:crypto'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = new Set(['owner', 'admin', 'member'])
const VALID_STATUSES = new Set(['active', 'inactive', 'pending'])

function requireRole(scope: TenantScope, roles: Array<'owner' | 'admin' | 'member'>) {
  if (!roles.includes(scope.role)) {
    return { error: 'Forbidden', status: 403 } as const
  }
  return null
}

export function usersRoutes() {
  const app = new Hono()
  app.use(tenantAuth)

  app.get('/', async (c) => {
    const scope = c.get('scope') as TenantScope
    const members = await listMembers(scope.namespace)
    const profileIds = [...new Set(members.map((m) => m.profileId).filter((id): id is string => Boolean(id)))]
    const profiles = await getUserProfilesByIds(profileIds)
    const profileMap = new Map(profiles.map((p) => [String(p.id), p]))

    return c.json(
      members.map((member) => {
        const { inviteCode, ...safeMember } = member
        return {
          ...safeMember,
          profile: member.profileId ? profileMap.get(String(member.profileId)) ?? null : null,
        }
      })
    )
  })

  app.post('/', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    const { email, role } = body || {}
    if (!role) {
      return c.json({ error: 'Role required' }, 400)
    }

    const validRoles: Array<'owner' | 'admin' | 'member'> = ['owner', 'admin', 'member']
    if (!validRoles.includes(role as 'owner' | 'admin' | 'member')) {
      return c.json({ error: 'Invalid role' }, 400)
    }

    if (role === 'owner' && scope.role !== 'owner') {
      return c.json({ error: 'Only owners can invite owners' }, 403)
    }

    if (!email || typeof email !== 'string') {
      return c.json({ error: 'Email required' }, 400)
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return c.json({ error: 'Invalid email' }, 400)
    }

    const existing = await listMembers(scope.namespace)
    if (existing.some((m) => m.email === normalizedEmail && m.status !== 'inactive')) {
      return c.json({ error: 'Member already invited' }, 409)
    }

    const inviteCode = crypto.randomBytes(32).toString('hex')
    const member = await createMember(scope.namespace, {
      email: normalizedEmail,
      role: role as 'owner' | 'admin' | 'member',
      status: 'pending',
      inviteCode,
      invitedBy: scope.memberId,
    })

    const { inviteCode: _, ...safeMember } = member
    const skipTrigger = c.req.header('x-restate-skip-trigger') === 'true'
    await dispatchTrigger(scope.namespace, 'members', 'create', safeMember, { skip: skipTrigger })

    return c.json(safeMember)
  })

  app.patch('/:id', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    const id = c.req.param('id')
    if (!id) {
      return c.json({ error: 'Member id required' }, 400)
    }

    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    const target = await getMemberById(scope.namespace, id)
    if (!target) {
      return c.json({ error: 'Member not found' }, 404)
    }

    const memberUpdate: Partial<{
      role: 'owner' | 'admin' | 'member'
      status: 'pending' | 'active' | 'inactive'
    }> = {}

    if (body.role !== undefined) {
      if (!VALID_ROLES.has(body.role as string)) {
        return c.json({ error: 'Invalid role' }, 400)
      }
      if (scope.role !== 'owner') {
        return c.json({ error: 'Only owners can change roles' }, 403)
      }
      if (id === scope.memberId && body.role !== 'owner') {
        return c.json({ error: 'Owners cannot demote themselves' }, 403)
      }
      memberUpdate.role = body.role as 'owner' | 'admin' | 'member'
    }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.has(body.status as string)) {
        return c.json({ error: 'Invalid status' }, 400)
      }
      if (target.role === 'owner' && scope.role !== 'owner') {
        return c.json({ error: 'Only owners can change owner status' }, 403)
      }
      if (id === scope.memberId && body.status !== 'active') {
        return c.json({ error: 'Cannot deactivate yourself' }, 403)
      }
      memberUpdate.status = body.status as 'pending' | 'active' | 'inactive'
    }

    let updated = target
    if (Object.keys(memberUpdate).length > 0) {
      const result = await updateMember(scope.namespace, id, memberUpdate)
      if (result) updated = result
    }

    if (body.profile) {
      if (typeof body.profile !== 'object' || body.profile === null || Array.isArray(body.profile)) {
        return c.json({ error: 'Invalid profile' }, 400)
      }
      if (target.role === 'owner' && scope.role !== 'owner') {
        return c.json({ error: 'Only owners can update owner profiles' }, 403)
      }
      if (!target.profileId) {
        return c.json({ error: 'Member has no profile' }, 400)
      }
      const allowed = ['name', 'gender', 'birthday', 'preferences']
      const profileUpdate: Record<string, unknown> = {}
      for (const key of allowed) {
        if (key in (body.profile as Record<string, unknown>)) {
          profileUpdate[key] = (body.profile as Record<string, unknown>)[key]
        }
      }
      if (Object.keys(profileUpdate).length > 0) {
        await updateUserProfile(target.profileId, profileUpdate)
      }
    }

    const { inviteCode, ...safeMember } = updated
    const skipTrigger = c.req.header('x-restate-skip-trigger') === 'true'
    await dispatchTrigger(scope.namespace, 'members', 'update', safeMember, { skip: skipTrigger })

    return c.json({ ok: true })
  })

  app.delete('/:id', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    const id = c.req.param('id')
    if (!id) {
      return c.json({ error: 'Member id required' }, 400)
    }

    const target = await getMemberById(scope.namespace, id)
    if (!target) {
      return c.json({ error: 'Member not found' }, 404)
    }

    if (target.role === 'owner' && scope.role !== 'owner') {
      return c.json({ error: 'Only owners can delete owners' }, 403)
    }

    if (id === scope.memberId) {
      return c.json({ error: 'Cannot delete yourself' }, 403)
    }

    await deleteMember(scope.namespace, id)

    const { inviteCode, ...safeMember } = target
    const skipTrigger = c.req.header('x-restate-skip-trigger') === 'true'
    await dispatchTrigger(scope.namespace, 'members', 'delete', safeMember, { skip: skipTrigger })

    return c.json({ ok: true })
  })

  return app
}
