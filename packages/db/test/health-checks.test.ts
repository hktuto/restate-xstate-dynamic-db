import { describe, it, expect, beforeEach } from 'vitest'
import {
  createHealthCheck, listLatestHealthChecks, listHealthCheckHistory,
  listHealthCheckHistoryForService, pruneHealthChecks, pruneHealthChecksByAge,
} from '../src/health-checks.js'
import { resetPlatformTables } from './helpers.js'

describe('health-checks', () => {
  beforeEach(async () => {
    await resetPlatformTables()
  })

  it('creates and lists latest health checks', async () => {
    await createHealthCheck({ service: 'api', status: 'healthy', responseTimeMs: 10, checkedAt: new Date().toISOString() })
    await createHealthCheck({ service: 'api', status: 'unhealthy', responseTimeMs: 20, checkedAt: new Date().toISOString() })

    const latest = await listLatestHealthChecks()
    expect(latest).toHaveLength(1)
    expect(latest[0].service).toBe('api')
  })

  it('lists history and history for a service', async () => {
    for (let i = 0; i < 5; i++) {
      await createHealthCheck({ service: 'api', status: 'healthy', responseTimeMs: i, checkedAt: new Date().toISOString() })
    }
    const history = await listHealthCheckHistory(10)
    expect(history.length).toBe(5)

    const forService = await listHealthCheckHistoryForService('api', 10)
    expect(forService.length).toBe(5)
  })

  it('returns latest health check per service', async () => {
    await createHealthCheck({ service: 'api', status: 'healthy', responseTimeMs: 10, checkedAt: new Date(Date.now() - 2000).toISOString() })
    await createHealthCheck({ service: 'api', status: 'unhealthy', responseTimeMs: 20, checkedAt: new Date().toISOString() })
    await createHealthCheck({ service: 'worker', status: 'healthy', responseTimeMs: 30, checkedAt: new Date(Date.now() - 1000).toISOString() })
    await createHealthCheck({ service: 'worker', status: 'healthy', responseTimeMs: 40, checkedAt: new Date().toISOString() })

    const latest = await listLatestHealthChecks()
    expect(latest).toHaveLength(2)
    const api = latest.find((r) => r.service === 'api')
    const worker = latest.find((r) => r.service === 'worker')
    expect(api?.status).toBe('unhealthy')
    expect(api?.responseTimeMs).toBe(20)
    expect(worker?.status).toBe('healthy')
    expect(worker?.responseTimeMs).toBe(40)
  })

  it('returns an empty array when no health checks exist', async () => {
    const latest = await listLatestHealthChecks()
    expect(latest).toEqual([])
  })

  it('preserves unhealthy status, message and details', async () => {
    await createHealthCheck({
      service: 'api',
      status: 'unhealthy',
      message: 'connection refused',
      details: { host: 'db1', port: 5432 },
      responseTimeMs: 50,
      checkedAt: new Date().toISOString(),
    })

    const latest = await listLatestHealthChecks()
    expect(latest).toHaveLength(1)
    expect(latest[0].status).toBe('unhealthy')
    expect(latest[0].message).toBe('connection refused')
    expect(latest[0].details).toEqual({ host: 'db1', port: 5432 })
  })

  it('prunes by count', async () => {
    for (let i = 0; i < 5; i++) {
      await createHealthCheck({ service: 'api', status: 'healthy', responseTimeMs: i, checkedAt: new Date().toISOString() })
    }
    await pruneHealthChecks('api', 2)
    const history = await listHealthCheckHistoryForService('api', 10)
    expect(history.length).toBe(2)
  })

  it('prunes by age', async () => {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    await createHealthCheck({ service: 'api', status: 'healthy', responseTimeMs: 1, checkedAt: old })
    await createHealthCheck({ service: 'api', status: 'healthy', responseTimeMs: 2, checkedAt: new Date().toISOString() })

    await pruneHealthChecksByAge('api', 60 * 60)
    const history = await listHealthCheckHistoryForService('api', 10)
    expect(history.length).toBe(1)
  })
})
