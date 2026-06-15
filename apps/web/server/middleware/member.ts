import { getMemberByProfileId } from 'db/tenant'
import { getTenantSession } from '#server/utils/auth'

declare module 'h3' {
  interface H3EventContext {
    member?: {
      id: string
      role: 'owner' | 'admin' | 'member'
    }
  }
}

export default defineEventHandler(async (event) => {
  const session = getTenantSession(event)
  if (!session || !event.context.company) return

  const member = await getMemberByProfileId(event.context.company.namespace, session.profileId)
  if (member && member.status === 'active') {
    event.context.member = {
      id: member.id,
      role: member.role
    }
  }
})
