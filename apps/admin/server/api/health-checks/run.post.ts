import { runHealthChecks } from '#server/utils/health-monitor'
import { createHealthCheck, pruneHealthChecks } from 'db/health-checks'
import { requireAdminSession } from '#server/utils/session'

const HISTORY_LIMIT = Number(process.env.HEALTH_CHECK_HISTORY_LIMIT ?? '100')

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const results = await runHealthChecks()
  const records = await Promise.all(
    results.map(async (result) => {
      const record = await createHealthCheck({
        service: result.service,
        status: result.status,
        checkedAt: new Date().toISOString(),
        responseTimeMs: result.responseTimeMs,
        message: result.message,
        details: result.details
      })
      await pruneHealthChecks(result.service, HISTORY_LIMIT)
      return record
    })
  )
  return records
})
