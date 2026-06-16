import { runHealthChecks } from '#server/utils/health-monitor'
import { createHealthCheck, pruneHealthChecks } from 'db/health-checks'

const INTERVAL_MS = Number(process.env.HEALTH_CHECK_INTERVAL_MS ?? '60000')
const HISTORY_LIMIT = Number(process.env.HEALTH_CHECK_HISTORY_LIMIT ?? '100')

export default defineNitroPlugin(() => {
  async function tick() {
    try {
      const results = await runHealthChecks()
      for (const result of results) {
        await createHealthCheck({
          service: result.service,
          status: result.status,
          checkedAt: new Date().toISOString(),
          responseTimeMs: result.responseTimeMs,
          message: result.message,
          details: result.details
        })
        await pruneHealthChecks(result.service, HISTORY_LIMIT)
      }
    } catch (err) {
      console.error('Health monitor tick failed:', err)
    }
  }

  tick().catch(console.error)
  setInterval(tick, INTERVAL_MS)
})
