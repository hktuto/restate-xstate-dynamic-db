import { getSurreal, closeSurreal } from 'db/client'
import type { HealthCheckInput, HealthCheckService } from './types.js'

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

async function checkRestate(): Promise<CheckResult> {
  const service: HealthCheckService = 'restate'
  const url = process.env.RESTATE_META_URL
  if (!url) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing RESTATE_META_URL' }
  }

  const start = Date.now()
  try {
    const res = await withTimeout(fetch(`${url}/services`), CHECK_TIMEOUT_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const body = await res.json() as { services?: Array<{ name?: string }> }
    const services = Array.isArray(body.services) ? body.services : []
    const hasWorkflow = services.some((s) => s.name === 'workflow')

    if (!hasWorkflow) {
      return {
        service,
        status: 'unhealthy',
        responseTimeMs: Date.now() - start,
        message: 'Restate is reachable but the workflow service is not registered'
      }
    }

    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return {
      service,
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      message: err instanceof Error ? err.message : String(err)
    }
  }
}

function checkWorkflowRuntime(): Promise<CheckResult> {
  return checkHttpService('workflow-runtime', 'WORKFLOW_HEALTH_URL', '/health')
}

function checkApi(): Promise<CheckResult> {
  return checkHttpService('api', 'API_URL', '/health')
}

const SERVICE_CHECKS: Record<HealthCheckService, () => Promise<CheckResult>> = {
  surrealdb: checkSurrealDB,
  restate: checkRestate,
  'workflow-runtime': checkWorkflowRuntime,
  api: checkApi,
}

export const VALID_SERVICES = Object.freeze(Object.keys(SERVICE_CHECKS) as HealthCheckService[])

export async function runHealthCheckForService(service: HealthCheckService): Promise<CheckResult> {
  const check = SERVICE_CHECKS[service]
  if (!check) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: `Unknown service: ${service}` }
  }
  return check()
}

export async function runHealthChecks(): Promise<CheckResult[]> {
  return Promise.all(VALID_SERVICES.map((service) => SERVICE_CHECKS[service]()))
}
