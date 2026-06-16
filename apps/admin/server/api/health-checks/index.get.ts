import { listHealthCheckHistory, listLatestHealthChecks } from 'db/health-checks'
import { requireAdminSession } from '#server/utils/session'

const HISTORY_LIMIT = Number(process.env.HEALTH_CHECK_HISTORY_LIMIT ?? '100')

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const [latest, history] = await Promise.all([
    listLatestHealthChecks(),
    listHealthCheckHistory(HISTORY_LIMIT)
  ])
  return { latest, history }
})
