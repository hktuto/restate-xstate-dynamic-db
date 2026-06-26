import { runHealthChecks, runHealthCheckForService, VALID_SERVICES } from './runner.js'
import { createHealthCheck, listLatestHealthChecks, listHealthCheckHistory, pruneHealthChecksByAge } from './db.js'
import type { HealthCheckRecord, HealthCheckService } from './types.js'

const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_RETENTION_DAYS = 365
const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_PORT = 3010

function parseRetentionMs(value: string | undefined): number {
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

function parsePort(value: string | undefined): number {
  const trimmed = value?.trim()
  if (trimmed === undefined || trimmed === '') return DEFAULT_PORT
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT
}

const INTERVAL_MS = parseIntervalMs(process.env.HEALTH_CHECK_INTERVAL_MS)
const RETENTION_MS = parseRetentionMs(process.env.HEALTH_CHECK_RETENTION_DAYS)
const PORT = parsePort(process.env.HEALTH_MONITOR_PORT)

if (INTERVAL_MS === null) {
  console.log('Health monitor scheduler disabled (HEALTH_CHECK_INTERVAL_MS=0)')
}

let isRunning = false
let isShuttingDown = false

async function refresh(service?: HealthCheckService): Promise<HealthCheckRecord[]> {
  const results = service === undefined
    ? await runHealthChecks()
    : [await runHealthCheckForService(service)]

  const records: HealthCheckRecord[] = []
  for (const result of results) {
    try {
      const record = createHealthCheck({
        service: result.service,
        status: result.status,
        checkedAt: new Date().toISOString(),
        responseTimeMs: result.responseTimeMs,
        message: result.message,
        details: result.details
      })
      pruneHealthChecksByAge(result.service, RETENTION_MS)
      records.push(record)
    } catch (err) {
      console.error(`Health monitor persistence failed for ${result.service}:`, err)
    }
  }
  return records
}

async function runRefresh(service?: HealthCheckService): Promise<{ ok: true; records: HealthCheckRecord[] } | { ok: false; error: string }> {
  if (isRunning) {
    return { ok: false, error: 'Refresh already in progress' }
  }
  if (isShuttingDown) {
    return { ok: false, error: 'Health monitor is shutting down' }
  }

  isRunning = true
  try {
    const records = await refresh(service)
    return { ok: true, records }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  } finally {
    isRunning = false
  }
}

async function tick() {
  const result = await runRefresh()
  if (result.ok) {
    console.log(`Health monitor tick completed: ${result.records.length} services checked`)
  } else {
    console.error('Health monitor tick failed:', result.error)
  }
}

function startScheduler() {
  if (INTERVAL_MS === null) return
  console.log(`Health monitor scheduler started: intervalMs=${INTERVAL_MS}, retentionDays=${RETENTION_MS / MS_PER_DAY}`)
  tick()
  return setInterval(tick, INTERVAL_MS)
}

let server: ReturnType<typeof Bun.serve> | undefined

function isValidService(value: string): value is HealthCheckService {
  return (VALID_SERVICES as string[]).includes(value)
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlStatusPage(checks: HealthCheckRecord[]): Response {
  const rows = checks
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    .map((c) => {
      const statusColor = c.status === 'healthy' ? 'green' : 'red'
      return `<tr>
          <td>${escapeHtml(c.service)}</td>
          <td style="color:${statusColor};font-weight:bold;">${escapeHtml(c.status)}</td>
          <td>${escapeHtml(c.checkedAt)}</td>
          <td>${escapeHtml(c.responseTimeMs)}ms</td>
          <td>${escapeHtml(c.message ?? '')}</td>
        </tr>`
    })
    .join('')

  const allHealthy = checks.length > 0 && checks.every((c) => c.status === 'healthy')
  const overall = allHealthy ? 'healthy' : checks.length === 0 ? 'unknown' : 'degraded'

  const body = `<!doctype html>
<html>
  <head><title>Platform Health</title></head>
  <body>
    <h1>Platform Health — ${overall}</h1>
    <table border="1" cellpadding="8" cellspacing="0">
      <thead>
        <tr><th>Service</th><th>Status</th><th>Checked At</th><th>Response Time</th><th>Message</th></tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5">No checks available</td></tr>'}
      </tbody>
    </table>
  </body>
</html>`

  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function startServer() {
  try {
    server = Bun.serve({
      port: PORT,
      async fetch(req) {
        const url = new URL(req.url)

        if (req.method === 'GET' && url.pathname === '/health') {
          return Response.json({ ok: true })
        }

        if (req.method === 'GET' && url.pathname === '/api/health-checks') {
          return Response.json({ latest: listLatestHealthChecks() })
        }

        if (req.method === 'GET' && url.pathname === '/api/health-checks/history') {
          const service = url.searchParams.get('service')
          if (!service || !isValidService(service)) {
            return Response.json({ error: 'Missing or invalid service' }, { status: 400 })
          }
          const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
          if (!Number.isFinite(limit) || limit <= 0) {
            return Response.json({ error: 'Invalid limit' }, { status: 400 })
          }
          return Response.json({ service, limit, history: listHealthCheckHistory(service, limit) })
        }

        if (req.method === 'GET' && url.pathname === '/status') {
          return htmlStatusPage(listLatestHealthChecks())
        }

        if (req.method === 'POST' && url.pathname === '/refresh') {
          let body: unknown
          try {
            body = await req.json()
          } catch {
            return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
          }

          if (body !== null && (typeof body !== 'object' || Array.isArray(body))) {
            return Response.json({ error: 'Invalid body' }, { status: 400 })
          }

          const service = (body as Record<string, unknown> | null)?.service
          if (service !== undefined && (typeof service !== 'string' || !isValidService(service))) {
            return Response.json({ error: 'Invalid service' }, { status: 400 })
          }

          const result = await runRefresh(service as HealthCheckService | undefined)
          if (!result.ok) {
            const isRoutine =
              result.error === 'Refresh already in progress' ||
              result.error === 'Health monitor is shutting down'
            if (isRoutine) {
              console.warn('Health monitor refresh skipped:', result.error)
            } else {
              console.error('Health monitor refresh failed:', result.error)
            }
            if (result.error === 'Refresh already in progress') {
              return Response.json({ error: 'Refresh already in progress' }, { status: 409 })
            }
            if (result.error === 'Health monitor is shutting down') {
              return Response.json({ error: 'Health monitor is shutting down' }, { status: 503 })
            }
            return Response.json({ error: 'Refresh failed' }, { status: 500 })
          }
          return Response.json({ results: result.records })
        }

        return Response.json({ error: 'Not found' }, { status: 404 })
      },
    })
    console.log(`Health monitor server started on port ${PORT}`)
    return server
  } catch (err) {
    console.error('Health monitor server failed to start:', err)
    return undefined
  }
}

let shutdownTimer: ReturnType<typeof setTimeout> | undefined

async function shutdown(signal: string) {
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

  try {
    await server?.stop()
  } catch (err) {
    console.error('Failed to stop health monitor server:', err)
  }

  const waitForRefresh = () => {
    if (isRunning) {
      setTimeout(waitForRefresh, 100)
      return
    }
    if (shutdownTimer) clearTimeout(shutdownTimer)
    process.exit(0)
  }
  waitForRefresh()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})

const interval = startScheduler()
startServer()
