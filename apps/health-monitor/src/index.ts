import { runHealthChecks } from './runner.js'
import { createHealthCheck, pruneHealthChecksByAge } from 'db/health-checks'

const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_RETENTION_DAYS = 365
const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseRetentionDays(value: string | undefined): number {
  const trimmed = value?.trim()
  if (trimmed === undefined || trimmed === '') return DEFAULT_RETENTION_DAYS * MS_PER_DAY
  const parsed = Number(trimmed)
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS
  return days * MS_PER_DAY
}

function parseIntervalMs(value: string | undefined): number | null {
  const trimmed = value?.trim()
  if (trimmed === '0') return null
  if (trimmed === undefined || trimmed === '') return DEFAULT_INTERVAL_MS
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS
}

const INTERVAL_MS = parseIntervalMs(process.env.HEALTH_CHECK_INTERVAL_MS)
const RETENTION_MS = parseRetentionDays(process.env.HEALTH_CHECK_RETENTION_DAYS)

if (INTERVAL_MS === null) {
  console.log('Health monitor disabled (HEALTH_CHECK_INTERVAL_MS=0)')
  process.exit(0)
}

console.log(`Health monitor started: intervalMs=${INTERVAL_MS}, retentionDays=${RETENTION_MS / MS_PER_DAY}`)

let isRunning = false
let isShuttingDown = false

async function tick() {
  if (isRunning) {
    console.warn('Health monitor tick skipped: previous tick still running')
    return
  }
  if (isShuttingDown) return

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
        await pruneHealthChecksByAge(result.service, RETENTION_MS)
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

let shutdownTimer: ReturnType<typeof setTimeout> | undefined

function shutdown(signal: string) {
  if (isShuttingDown) return
  console.log(`Health monitor received ${signal}, shutting down...`)
  isShuttingDown = true
  if (interval) {
    clearInterval(interval)
  }
  shutdownTimer = setTimeout(() => {
    console.error('Health monitor shutdown timed out; forcing exit')
    process.exit(1)
  }, 30_000)
  const check = () => {
    if (isRunning) {
      setTimeout(check, 100)
      return
    }
    process.exit(0)
  }
  check()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})

await tick()
const interval = setInterval(tick, INTERVAL_MS)
