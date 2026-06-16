import { listHealthCheckHistory, listLatestHealthChecks } from 'db/health-checks'
import { requireAdminSession } from '#server/utils/session'
import { HEALTH_CHECK_HISTORY_LIMIT } from '#server/utils/health-check-config'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const [latest, history] = await Promise.all([
    listLatestHealthChecks(),
    listHealthCheckHistory(HEALTH_CHECK_HISTORY_LIMIT)
  ])
  return { latest, history }
})
