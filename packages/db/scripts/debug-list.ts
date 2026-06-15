import { listMembers } from '../src/tenant.js'
import { getUserProfilesByIds } from '../src/platform.js'

async function main() {
  const namespace = 'company_40376b02123641e9bfdb4c5860c6964f'
  const members = await listMembers(namespace)
  console.log('members:', members)
  const profileIds = members.map(m => m.profileId).filter(Boolean)
  console.log('profileIds:', profileIds, 'types:', profileIds.map(id => typeof id))
  const profiles = await getUserProfilesByIds(profileIds as string[])
  console.log('profiles:', profiles)
  const profileMap = new Map(profiles.map(p => [String(p.id), p]))
  console.log('map keys:', [...profileMap.keys()])
  console.log('lookup:', members[0]?.profileId, '->', profileMap.get(String(members[0]?.profileId)))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
