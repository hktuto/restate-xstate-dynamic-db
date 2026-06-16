import { listCompaniesForProfile } from 'db/platform'
import { requireTenantSession } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = requireTenantSession(event)
  const companies = await listCompaniesForProfile(session.profileId)
  return companies
})
