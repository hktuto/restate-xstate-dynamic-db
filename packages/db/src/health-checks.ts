import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'

export type HealthCheckService = string
export type HealthCheckStatus = 'healthy' | 'unhealthy'

export interface HealthCheckRecord {
  id: string
  service: HealthCheckService
  status: HealthCheckStatus
  checkedAt: string
  responseTimeMs: number
  message?: string
  details?: Record<string, unknown>
}

export interface HealthCheckInput {
  service: HealthCheckService
  status: HealthCheckStatus
  checkedAt: string
  responseTimeMs: number
  message?: string
  details?: Record<string, unknown>
}

export async function createHealthCheck(input: HealthCheckInput): Promise<HealthCheckRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [created] = await surreal.query<[HealthCheckRecord[]]>(
      'CREATE health_checks CONTENT $data',
      { data: input }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listLatestHealthChecks(): Promise<HealthCheckRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [services] = await surreal.query<[HealthCheckService[]]>(
      'SELECT VALUE service FROM health_checks GROUP BY service'
    )
    if (services.length === 0) return []

    const params: Record<string, HealthCheckService> = {}
    const statements = services.map((service, index) => {
      const key = `service${index}`
      params[key] = service
      return `SELECT * FROM health_checks WHERE service = $${key} ORDER BY checkedAt DESC LIMIT 1`
    })

    const results = await surreal.query<HealthCheckRecord[][]>(statements.join(';'), params)
    const records = results
      .map((rows) => rows[0])
      .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    return normalizeIds(records)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listHealthCheckHistory(limit: number): Promise<HealthCheckRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [records] = await surreal.query<[HealthCheckRecord[]]>(
      'SELECT * FROM health_checks ORDER BY checkedAt DESC LIMIT $limit',
      { limit }
    )
    return normalizeIds(records)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listHealthCheckHistoryForService(
  service: HealthCheckService,
  limit: number
): Promise<HealthCheckRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [records] = await surreal.query<[HealthCheckRecord[]]>(
      'SELECT * FROM health_checks WHERE service = $service ORDER BY checkedAt DESC LIMIT $limit',
      { service, limit }
    )
    return normalizeIds(records)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function pruneHealthChecks(service: HealthCheckService, keep: number): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query(
      `DELETE health_checks WHERE id NOT IN (
        SELECT VALUE id FROM health_checks WHERE service = $service ORDER BY checkedAt DESC LIMIT $keep
      ) AND service = $service`,
      { service, keep }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function pruneHealthChecksByAge(
  service: HealthCheckService,
  retentionMs: number
): Promise<void> {
  const cutoff = new Date(Date.now() - retentionMs).toISOString()
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query(
      'DELETE health_checks WHERE service = $service AND checkedAt < $cutoff',
      { service, cutoff }
    )
  } finally {
    await closeSurreal(surreal)
  }
}
