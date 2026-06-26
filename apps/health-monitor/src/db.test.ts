import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  createHealthCheck,
  listLatestHealthChecks,
  listHealthCheckHistory,
  pruneHealthChecksByAge,
  closeDatabase,
} from './db.js'

describe('health-check db', () => {
  beforeEach(() => {
    process.env.HEALTH_MONITOR_DB_PATH = ':memory:'
  })

  afterEach(() => {
    closeDatabase()
    delete process.env.HEALTH_MONITOR_DB_PATH
  })

  it('returns the latest check per service', () => {
    createHealthCheck({ service: 'api', status: 'healthy', checkedAt: '2026-06-26T00:00:00.000Z', responseTimeMs: 10 })
    createHealthCheck({ service: 'api', status: 'unhealthy', checkedAt: '2026-06-26T00:01:00.000Z', responseTimeMs: 20, message: 'timeout' })
    createHealthCheck({ service: 'surrealdb', status: 'healthy', checkedAt: '2026-06-26T00:02:00.000Z', responseTimeMs: 5 })

    const latest = listLatestHealthChecks()
    expect(latest).toHaveLength(2)
    expect(latest.find((r) => r.service === 'api')?.status).toBe('unhealthy')
    expect(latest.find((r) => r.service === 'surrealdb')?.checkedAt).toBe('2026-06-26T00:02:00.000Z')
    expect(latest.find((r) => r.service === 'api')?.responseTimeMs).toBe(20)
    expect(latest.find((r) => r.service === 'api')?.message).toBe('timeout')
  })

  it('returns history for a service', () => {
    createHealthCheck({ service: 'surrealdb', status: 'healthy', checkedAt: '2026-06-26T00:00:00.000Z', responseTimeMs: 5 })
    createHealthCheck({ service: 'surrealdb', status: 'healthy', checkedAt: '2026-06-26T00:01:00.000Z', responseTimeMs: 6 })

    const history = listHealthCheckHistory('surrealdb', 5)
    expect(history).toHaveLength(2)
    expect(history[0].checkedAt).toBe('2026-06-26T00:01:00.000Z')
  })

  it('round-trips details as JSON', () => {
    createHealthCheck({
      service: 'api',
      status: 'healthy',
      checkedAt: '2026-06-26T00:00:00.000Z',
      responseTimeMs: 10,
      details: { foo: 'bar' },
    })
    const history = listHealthCheckHistory('api', 1)
    expect(history[0].details).toEqual({ foo: 'bar' })
  })

  it('returns empty arrays when no checks exist', () => {
    expect(listLatestHealthChecks()).toHaveLength(0)
    expect(listHealthCheckHistory('api', 10)).toHaveLength(0)
  })

  it('prunes records older than retention without affecting other services', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    createHealthCheck({ service: 'restate', status: 'healthy', checkedAt: old, responseTimeMs: 1 })
    createHealthCheck({ service: 'restate', status: 'healthy', checkedAt: recent, responseTimeMs: 2 })
    createHealthCheck({ service: 'api', status: 'healthy', checkedAt: old, responseTimeMs: 3 })

    pruneHealthChecksByAge('restate', 24 * 60 * 60 * 1000)

    const restateHistory = listHealthCheckHistory('restate', 10)
    expect(restateHistory).toHaveLength(1)
    expect(restateHistory[0].checkedAt).toBe(recent)

    const apiHistory = listHealthCheckHistory('api', 10)
    expect(apiHistory).toHaveLength(1)
  })
})
