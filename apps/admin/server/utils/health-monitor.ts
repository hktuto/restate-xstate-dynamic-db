import { getSurreal, closeSurreal } from 'db/client'
import type { HealthCheckService, HealthCheckStatus } from 'db/health-checks'

const CHECK_TIMEOUT_MS = 5000

interface CheckResult {
  service: HealthCheckService
  status: HealthCheckStatus
  responseTimeMs: number
  message?: string
  details?: Record<string, unknown>
}

function getEnv(name: string): string | undefined {
  return process.env[name]
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout])
}

async function checkSurrealDB(): Promise<CheckResult> {
  const service: HealthCheckService = 'surrealdb'
  const url = getEnv('SURREAL_URL')
  const user = getEnv('SURREAL_USER')
  const pass = getEnv('SURREAL_PASS')
  if (!url || !user || !pass) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing SurrealDB env vars' }
  }
  const start = Date.now()
  try {
    const surreal = await getSurreal('platform', 'admin')
    try {
      await surreal.query('SELECT 1 FROM 1')
      return { service, status: 'healthy', responseTimeMs: Date.now() - start }
    } finally {
      await closeSurreal(surreal)
    }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
}

async function checkRestate(): Promise<CheckResult> {
  const service: HealthCheckService = 'restate'
  const url = getEnv('RESTATE_META_URL')
  if (!url) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing RESTATE_META_URL' }
  }
  const start = Date.now()
  try {
    const res = await withTimeout(fetch(`${url}/services`), CHECK_TIMEOUT_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
}

async function checkWorkflowRuntime(): Promise<CheckResult> {
  const service: HealthCheckService = 'workflow-runtime'
  const url = getEnv('WORKFLOW_RUNTIME_URL')
  if (!url) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing WORKFLOW_RUNTIME_URL' }
  }
  const start = Date.now()
  try {
    const res = await withTimeout(fetch(`${url}/health`), CHECK_TIMEOUT_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
}

async function checkWebApi(): Promise<CheckResult> {
  const service: HealthCheckService = 'web-api'
  const url = getEnv('WEB_API_URL')
  if (!url) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing WEB_API_URL' }
  }
  const start = Date.now()
  try {
    const res = await withTimeout(fetch(`${url}/api/health`), CHECK_TIMEOUT_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
}

export async function runHealthChecks(): Promise<CheckResult[]> {
  return Promise.all([
    checkSurrealDB(),
    checkRestate(),
    checkWorkflowRuntime(),
    checkWebApi()
  ])
}
