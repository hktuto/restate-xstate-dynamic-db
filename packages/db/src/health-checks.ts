import { getSurreal, closeSurreal } from './client.js'

export type HealthCheckService = 'surrealdb' | 'restate' | 'workflow-runtime' | 'web-api'
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

const ALL_SERVICES: HealthCheckService[] = [
  'surrealdb',
  'restate',
  'workflow-runtime',
  'web-api'
]

export async function createHealthCheck(input: HealthCheckInput): Promise<HealthCheckRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [created] = await surreal.query<[HealthCheckRecord[]]>(
      'CREATE health_checks CONTENT $data',
      { data: input }
    )
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listLatestHealthChecks(): Promise<HealthCheckRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const results = await Promise.all(
      ALL_SERVICES.map(async (service) => {
        const [records] = await surreal.query<[HealthCheckRecord[]]>(
          'SELECT * FROM health_checks WHERE service = $service ORDER BY checkedAt DESC LIMIT 1',
          { service }
        )
        return records[0]
      })
    )
    return results.filter((record): record is HealthCheckRecord => record !== undefined)
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
    return records
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
