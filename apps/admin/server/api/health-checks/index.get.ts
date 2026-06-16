import { listLatestHealthChecks } from 'db/health-checks'
import { requireAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const latest = await listLatestHealthChecks()
  return { latest }
})
