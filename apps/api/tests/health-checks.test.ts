import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { createApp } from '../src/app.js'
import { signAdminAccessTokenCookie } from './helpers.js'

const app = createApp()

const adminCookie = () =>
  `admin_access_token=${signAdminAccessTokenCookie('platform_users:admin', 'admin@example.com')}`

describe('GET /api/admin/health-checks', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = process.env.HEALTH_MONITOR_URL

  beforeAll(() => {
    process.env.HEALTH_MONITOR_URL = 'http://localhost:3010'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  afterAll(() => {
    process.env.HEALTH_MONITOR_URL = originalEnv
  })

  it('forwards latest checks from the health monitor', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        latest: [{ id: 1, service: 'api', status: 'healthy', checkedAt: new Date().toISOString(), responseTimeMs: 12 }],
      }),
    } as unknown as Response)

    const res = await app.request('/api/admin/health-checks', {
      headers: { Cookie: adminCookie() },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as { latest: unknown[] }
    expect(data.latest).toHaveLength(1)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3010/api/health-checks',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('returns 503 when HEALTH_MONITOR_URL is missing', async () => {
    const previousUrl = process.env.HEALTH_MONITOR_URL
    delete process.env.HEALTH_MONITOR_URL
    globalThis.fetch = vi.fn()

    try {
      const res = await app.request('/api/admin/health-checks', {
        headers: { Cookie: adminCookie() },
      })

      expect(res.status).toBe(503)
      const data = (await res.json()) as { error: string }
      expect(data.error).toBe('Health monitor unavailable')
      expect(globalThis.fetch).not.toHaveBeenCalled()
    } finally {
      process.env.HEALTH_MONITOR_URL = previousUrl
    }
  })

  it('returns 502 when the health monitor is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const res = await app.request('/api/admin/health-checks', {
      headers: { Cookie: adminCookie() },
    })

    expect(res.status).toBe(502)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Health monitor unavailable')
  })
})

describe('GET /api/admin/health-checks/history', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = process.env.HEALTH_MONITOR_URL

  beforeAll(() => {
    process.env.HEALTH_MONITOR_URL = 'http://localhost:3010'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  afterAll(() => {
    process.env.HEALTH_MONITOR_URL = originalEnv
  })

  it('forwards history from the health monitor', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        service: 'surrealdb',
        limit: 5,
        history: [{ id: 1, service: 'surrealdb', status: 'healthy', checkedAt: new Date().toISOString(), responseTimeMs: 7 }],
      }),
    } as unknown as Response)

    const res = await app.request('/api/admin/health-checks/history?service=surrealdb&limit=5', {
      headers: { Cookie: adminCookie() },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as { service: string; limit: number; history: unknown[] }
    expect(data.service).toBe('surrealdb')
    expect(data.limit).toBe(5)
    expect(data.history).toHaveLength(1)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3010/api/health-checks/history?service=surrealdb&limit=5',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('returns 400 for an invalid service', async () => {
    globalThis.fetch = vi.fn()

    const res = await app.request('/api/admin/health-checks/history?service=invalid&limit=5', {
      headers: { Cookie: adminCookie() },
    })

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Missing or invalid service query parameter')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid limit', async () => {
    globalThis.fetch = vi.fn()

    const res = await app.request('/api/admin/health-checks/history?service=surrealdb&limit=-1', {
      headers: { Cookie: adminCookie() },
    })

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid limit query parameter')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('returns 401 for unauthenticated requests', async () => {
    globalThis.fetch = vi.fn()

    const res = await app.request('/api/admin/health-checks/history?service=surrealdb&limit=5')

    expect(res.status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
