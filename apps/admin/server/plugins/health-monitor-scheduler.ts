import { runHealthChecks } from '#server/utils/health-monitor'
import { createHealthCheck, pruneHealthChecks } from 'db/health-checks'

const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_HISTORY_LIMIT = 100

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseIntervalMs(value: string | undefined): number | null {
  if (value === '0') return null
  if (value === undefined || value === '') return DEFAULT_INTERVAL_MS
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS
}

const INTERVAL_MS = parseIntervalMs(process.env.HEALTH_CHECK_INTERVAL_MS)
const HISTORY_LIMIT = parsePositiveInt(process.env.HEALTH_CHECK_HISTORY_LIMIT, DEFAULT_HISTORY_LIMIT)

export default defineNitroPlugin((nitroApp) => {
  if (INTERVAL_MS === null) {
    console.log('Health monitor scheduler disabled (HEALTH_CHECK_INTERVAL_MS=0)')
    return
  }

  console.log(`Health monitor scheduler started: intervalMs=${INTERVAL_MS}, historyLimit=${HISTORY_LIMIT}`)

  let isRunning = false

  async function tick() {
    if (isRunning) {
      console.warn('Health monitor tick skipped: previous tick still running')
      return
    }
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
      console.log(`Health monitor tick completed: ${results.length} services checked`)
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
    console.log('Health monitor scheduler stopped')
  })
})
