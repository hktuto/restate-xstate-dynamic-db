// Matches the service list monitored by src/runner.ts
export type HealthCheckService = 'surrealdb' | 'restate' | 'workflow-runtime' | 'api'
export type HealthCheckStatus = 'healthy' | 'unhealthy'

export interface HealthCheckInput {
  service: HealthCheckService
  status: HealthCheckStatus
  /** ISO 8601 timestamp, e.g. `2026-06-26T01:43:15.671Z` */
  checkedAt: string
  responseTimeMs: number
  message?: string
  details?: Record<string, unknown>
}

export interface HealthCheckRecord extends HealthCheckInput {
  id: number
}
