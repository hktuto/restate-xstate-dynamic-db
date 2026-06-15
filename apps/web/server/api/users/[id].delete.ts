import { deleteMember, getMemberById } from 'db/tenant'
import { requireTenantSession } from '#server/utils/auth'
import { dispatchTrigger } from '#server/utils/dispatch'

export default defineEventHandler(async (event) => {
  requireTenantSession(event)

  const currentMember = event.context.member
  if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Member id required' })
  }

  const namespace = event.context.company.namespace
  const target = await getMemberById(namespace, id)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }

  if (target.role === 'owner' && currentMember.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owners can delete owners' })
  }

  if (id === currentMember.id) {
    throw createError({ statusCode: 403, statusMessage: 'Cannot delete yourself' })
  }

  await deleteMember(namespace, id)

  const { inviteCode, ...safeMember } = target
  await dispatchTrigger(event, 'members', 'delete', safeMember)

  return { ok: true }
})
