import { getSurreal, closeSurreal } from 'db/client'
import type { HealthCheckInput, HealthCheckService } from 'db/health-checks'

const CHECK_TIMEOUT_MS = 5000
type CheckResult = Omit<HealthCheckInput, 'checkedAt'>

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer))
  })
}

async function checkSurrealDB(): Promise<CheckResult> {
  const service: HealthCheckService = 'surrealdb'
  const url = process.env.SURREAL_URL
  const user = process.env.SURREAL_USER
  const pass = process.env.SURREAL_PASS
  if (!url || !user || !pass) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing SurrealDB env vars' }
  }
  const start = Date.now()
  try {
    await withTimeout((async () => {
      const surreal = await getSurreal('platform', 'admin')
      try {
        await surreal.query('RETURN 1')
      } finally {
        try { await closeSurreal(surreal) } catch {}
      }
    })(), CHECK_TIMEOUT_MS)
    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
}

async function checkHttpService(
  service: HealthCheckService,
  envVarName: string,
  path: string
): Promise<CheckResult> {
  const url = process.env[envVarName]
  if (!url) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: `Missing ${envVarName}` }
  }
  const start = Date.now()
  try {
    const res = await withTimeout(fetch(`${url}${path}`), CHECK_TIMEOUT_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
}

function checkRestate(): Promise<CheckResult> {
  return checkHttpService('restate', 'RESTATE_META_URL', '/services')
}

function checkWorkflowRuntime(): Promise<CheckResult> {
  return checkHttpService('workflow-runtime', 'WORKFLOW_RUNTIME_URL', '/health')
}

function checkWebApi(): Promise<CheckResult> {
  return checkHttpService('web-api', 'WEB_API_URL', '/api/health')
}

export async function runHealthChecks(): Promise<CheckResult[]> {
  return Promise.all([
    checkSurrealDB(),
    checkRestate(),
    checkWorkflowRuntime(),
    checkWebApi()
  ])
}
