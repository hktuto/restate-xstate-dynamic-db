import { listLatestHealthChecks, type HealthCheckRecord } from 'db/health-checks'

export type PlatformMode = 'normal' | 'degraded' | 'maintenance'

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
  return checks.reduce(
    (latest, check) => (check.checkedAt > latest ? check.checkedAt : latest),
    checks[0].checkedAt
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

export async function getPlatformStatus(): Promise<PlatformStatus> {
  let checks: HealthCheckRecord[]
  try {
    checks = await listLatestHealthChecks()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { mode: 'maintenance', message: `Failed to read health checks: ${message}`, checks: [] }
  }

  const checkedAt = getNewestCheckedAt(checks)

  if (checks.length === 0 || isStale(checks)) {
    return {
      mode: 'maintenance',
      message: 'Health checks are stale or unavailable',
      checks,
      checkedAt
    }
  }

  if (isUnhealthy(checks, 'surrealdb') || isUnhealthy(checks, 'web-api')) {
    return {
      mode: 'maintenance',
      message: 'Platform maintenance in progress',
      checks,
      checkedAt
    }
  }

  if (isUnhealthy(checks, 'restate') || isUnhealthy(checks, 'workflow-runtime')) {
    return {
      mode: 'degraded',
      message: 'Some features are temporarily unavailable',
      checks,
      checkedAt
    }
  }

  return { mode: 'normal', checks, checkedAt }
}
