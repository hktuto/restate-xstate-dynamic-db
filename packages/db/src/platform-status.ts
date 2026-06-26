export type PlatformMode = 'normal' | 'degraded' | 'maintenance'

export interface HealthCheckRecord {
  id: number | string
  service: string
  status: 'healthy' | 'unhealthy'
  checkedAt: string
  responseTimeMs: number
  message?: string
  details?: Record<string, unknown>
}

export interface PlatformStatus {
  mode: PlatformMode
  message?: string
  checks: HealthCheckRecord[]
  checkedAt?: string
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const STALENESS_MS = parsePositiveInt(process.env.PLATFORM_STATUS_STALENESS_MS, 5 * 60 * 1000)

function getNewestCheckedAt(checks: HealthCheckRecord[]): string | undefined {
  if (checks.length === 0) return undefined
  return checks.reduce<string>(
    (latest, check) => (check.checkedAt && check.checkedAt > latest ? check.checkedAt : latest),
    checks[0]!.checkedAt!
  )
}

function isStale(checks: HealthCheckRecord[]): boolean {
  const newest = getNewestCheckedAt(checks)
  if (!newest) return true
  return Date.now() - new Date(newest).getTime() > STALENESS_MS
}

function isUnhealthy(checks: HealthCheckRecord[], service: string): boolean {
  return checks.some((check) => check.service === service && check.status === 'unhealthy')
}

async function fetchLatestChecks(): Promise<{ ok: true; checks: HealthCheckRecord[] } | { ok: false; error: string }> {
  const healthMonitorUrl = process.env.HEALTH_MONITOR_URL
  if (!healthMonitorUrl) {
    return { ok: false, error: 'HEALTH_MONITOR_URL is not configured' }
  }

  try {
    const res = await fetch(new URL('/api/health-checks', healthMonitorUrl).toString(), {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown')
      return { ok: false, error: `Health monitor returned HTTP ${res.status}: ${text}` }
    }
    const data = (await res.json()) as { latest?: unknown }
    if (!Array.isArray(data.latest)) {
      return { ok: false, error: 'Invalid response from health monitor' }
    }
    return { ok: true, checks: data.latest as HealthCheckRecord[] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

export async function getPlatformStatus(): Promise<PlatformStatus> {
  const checksResult = await fetchLatestChecks()
  if (!checksResult.ok) {
    return { mode: 'normal', message: `Health checks unavailable: ${checksResult.error}`, checks: [] }
  }

  const checks = checksResult.checks
  const checkedAt = getNewestCheckedAt(checks)

  if (checks.length === 0 || isStale(checks)) {
    return {
      mode: 'normal',
      message: 'Health checks are stale or unavailable',
      checks,
      checkedAt,
    }
  }

  if (isUnhealthy(checks, 'surrealdb')) {
    return {
      mode: 'maintenance',
      message: 'Platform maintenance in progress',
      checks,
      checkedAt,
    }
  }

  if (isUnhealthy(checks, 'api')) {
    return {
      mode: 'degraded',
      message: 'API is temporarily unhealthy',
      checks,
      checkedAt,
    }
  }

  if (isUnhealthy(checks, 'restate') || isUnhealthy(checks, 'workflow-runtime')) {
    return {
      mode: 'degraded',
      message: 'Some features are temporarily unavailable',
      checks,
      checkedAt,
    }
  }

  return { mode: 'normal', checks, checkedAt }
}
