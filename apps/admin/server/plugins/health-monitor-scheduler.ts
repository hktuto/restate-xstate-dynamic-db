import { runHealthChecks } from '#server/utils/health-monitor'
import { createHealthCheck, pruneHealthChecks } from 'db/health-checks'

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const INTERVAL_MS = parsePositiveInt(process.env.HEALTH_CHECK_INTERVAL_MS, 60_000)
const HISTORY_LIMIT = parsePositiveInt(process.env.HEALTH_CHECK_HISTORY_LIMIT, 100)

export default defineNitroPlugin((nitroApp) => {
  let isRunning = false

  async function tick() {
    if (isRunning) return
    isRunning = true
    try {
      const results = await runHealthChecks()
      for (const result of results) {
        try {
          await createHealthCheck({
            service: result.service,
            status: result.status,
            checkedAt: new Date().toISOString(),
            responseTimeMs: result.responseTimeMs,
            message: result.message,
            details: result.details
          })
          await pruneHealthChecks(result.service, HISTORY_LIMIT)
        } catch (err) {
          console.error(`Health monitor persistence failed for ${result.service}:`, err)
        }
      }
    } catch (err) {
      console.error('Health monitor tick failed:', err)
    } finally {
      isRunning = false
    }
  }

  tick().catch(console.error)
  const interval = setInterval(tick, INTERVAL_MS)

  nitroApp.hooks.hook('close', () => {
    clearInterval(interval)
  })
})
