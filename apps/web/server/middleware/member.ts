import { getMemberByProfileId } from 'db/tenant'
import { getTenantSession, getTenantCompany } from '#server/utils/auth'

declare module 'h3' {
  interface H3EventContext {
    account?: { id: string }
    profile?: { id: string }
    company?: { id: string; slug: string; namespace: string }
    member?: { id: string; role: 'owner' | 'admin' | 'member' }
  }
}

export default defineEventHandler(async (event) => {
  const session = getTenantSession(event)
  if (!session) return

  event.context.account = { id: session.accountId }
  event.context.profile = { id: session.profileId }

  const company = getTenantCompany(event)
  if (!company) return

  event.context.company = company

  const member = await getMemberByProfileId(company.namespace, session.profileId)
  if (member && member.status === 'active') {
    event.context.member = { id: member.id, role: member.role }
  }
})
