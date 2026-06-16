import { updateMember, getMemberById } from 'db/tenant'
import { updateUserProfile } from 'db/platform'
import { requireTenantRole } from '#server/utils/auth'
import { dispatchTrigger } from '#server/utils/dispatch'

const VALID_ROLES = new Set(['owner', 'admin', 'member'])
const VALID_STATUSES = new Set(['active', 'inactive', 'pending'])

export default defineEventHandler(async (event) => {
  const currentMember = requireTenantRole(event, ['owner', 'admin'])

  const company = event.context.company
  if (!company) {
    throw createError({ statusCode: 500, statusMessage: 'Company context missing' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Member id required' })
  }

  const body = await readBody(event)
  const namespace = company.namespace

  const target = await getMemberById(namespace, id)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }

  const memberUpdate: Partial<{
    role: 'owner' | 'admin' | 'member'
    status: 'pending' | 'active' | 'inactive'
  }> = {}

  if (body.role !== undefined) {
    if (!VALID_ROLES.has(body.role)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
    }
    if (currentMember.role !== 'owner') {
      throw createError({ statusCode: 403, statusMessage: 'Only owners can change roles' })
    }
    if (id === currentMember.id && body.role !== 'owner') {
      throw createError({ statusCode: 403, statusMessage: 'Owners cannot demote themselves' })
    }
    memberUpdate.role = body.role
  }

  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    }
    if (target.role === 'owner' && currentMember.role !== 'owner') {
      throw createError({ statusCode: 403, statusMessage: 'Only owners can change owner status' })
    }
    if (id === currentMember.id && body.status !== 'active') {
      throw createError({ statusCode: 403, statusMessage: 'Cannot deactivate yourself' })
    }
    memberUpdate.status = body.status
  }

  let updated = target
  if (Object.keys(memberUpdate).length > 0) {
    const result = await updateMember(namespace, id, memberUpdate)
    if (result) updated = result
  }

  if (body.profile) {
    if (typeof body.profile !== 'object' || body.profile === null || Array.isArray(body.profile)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid profile' })
    }
    if (target.role === 'owner' && currentMember.role !== 'owner') {
      throw createError({ statusCode: 403, statusMessage: 'Only owners can update owner profiles' })
    }
    if (!target.profileId) {
      throw createError({ statusCode: 400, statusMessage: 'Member has no profile' })
    }
    const allowed = ['name', 'gender', 'birthday', 'preferences']
    const profileUpdate: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body.profile) {
        profileUpdate[key] = body.profile[key]
      }
    }
    if (Object.keys(profileUpdate).length > 0) {
      await updateUserProfile(target.profileId, profileUpdate)
    }
  }

  const { inviteCode, ...safeMember } = updated
  await dispatchTrigger(event, 'members', 'update', safeMember)

  return { ok: true }
})
