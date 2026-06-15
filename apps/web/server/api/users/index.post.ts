import { listMembers, createMember } from 'db/tenant'
import { dispatchTrigger } from '#server/utils/dispatch'
import { requireTenantSession } from '#server/utils/auth'
import crypto from 'node:crypto'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const session = requireTenantSession(event)
  const currentMember = event.context.member
  if (!currentMember || !['owner', 'admin'].includes(currentMember.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const { email, role } = body || {}

  if (!role) {
    throw createError({ statusCode: 400, statusMessage: 'Role required' })
  }

  const validRoles: Array<'owner' | 'admin' | 'member'> = ['owner', 'admin', 'member']
  if (!validRoles.includes(role)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  }

  if (role === 'owner' && currentMember.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only owners can invite owners' })
  }

  if (!email || typeof email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Email required' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  }

  const existing = await listMembers(event.context.company.namespace)
  if (existing.some(m => m.email === normalizedEmail && m.status !== 'inactive')) {
    throw createError({ statusCode: 409, statusMessage: 'Member already invited' })
  }

  const inviteCode = crypto.randomBytes(32).toString('hex')
  const member = await createMember(event.context.company.namespace, {
    email: normalizedEmail,
    role,
    status: 'pending',
    inviteCode,
    invitedBy: currentMember.id
  })

  const { inviteCode: _, ...safeMember } = member
  await dispatchTrigger(event, 'members', 'create', safeMember)

  return safeMember
})
