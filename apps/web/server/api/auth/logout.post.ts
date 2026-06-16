import { clearTenantSession, clearTenantCompany } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  clearTenantSession(event)
  clearTenantCompany(event)
  return { ok: true }
})
