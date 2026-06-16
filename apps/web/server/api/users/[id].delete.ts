import { deleteMember, getMemberById } from 'db/tenant'
import { requireTenantRole } from '#server/utils/auth'
import { dispatchTrigger } from '#server/utils/dispatch'

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

  const namespace = company.namespace
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
