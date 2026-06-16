import { runHealthChecks } from '#server/utils/health-monitor'
import { createHealthCheck, pruneHealthChecks } from 'db/health-checks'
import { requireAdminSession } from '#server/utils/session'
import { HEALTH_CHECK_HISTORY_LIMIT } from '#server/utils/health-check-config'

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const results = await runHealthChecks()
  const checkedAt = new Date().toISOString()
  try {
    const records = await Promise.all(
      results.map(async (result) => {
        const record = await createHealthCheck({
          service: result.service,
          status: result.status,
          checkedAt,
          responseTimeMs: result.responseTimeMs,
          message: result.message,
          details: result.details
        })
        await pruneHealthChecks(result.service, HEALTH_CHECK_HISTORY_LIMIT)
        return record
      })
    )
    return records
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw createError({ statusCode: 500, statusMessage: `Failed to persist health check results: ${message}` })
  }
})
