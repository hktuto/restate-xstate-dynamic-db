import { listMembers } from 'db/tenant'
import { getUserProfilesByIds } from 'db/platform'
import { requireTenantSession } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantSession(event)
  const namespace = event.context.company.namespace
  const members = await listMembers(namespace)
  const profileIds = [...new Set(members.map(m => m.profileId).filter((id): id is string => Boolean(id)))]
  const profiles = await getUserProfilesByIds(profileIds)
  const profileMap = new Map(profiles.map(p => [String(p.id), p]))

  return members.map(member => {
    const { inviteCode, ...safeMember } = member
    return {
      ...safeMember,
      profile: member.profileId ? profileMap.get(String(member.profileId)) ?? null : null
    }
  })
})
