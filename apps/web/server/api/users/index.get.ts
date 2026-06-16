import { listMembers } from 'db/tenant'
import { getUserProfilesByIds } from 'db/platform'
import { requireTenantMember } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantMember(event)

  const company = event.context.company
  if (!company) {
    throw createError({ statusCode: 500, statusMessage: 'Company context missing' })
  }

  const namespace = company.namespace
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
