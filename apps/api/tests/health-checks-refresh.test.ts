import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { createApp } from '../src/app.js'
import { signAdminAccessTokenCookie } from './helpers.js'

const app = createApp()

const adminCookie = () =>
  `admin_access_token=${signAdminAccessTokenCookie('platform_users:admin', 'admin@example.com')}`

describe('POST /api/admin/health-checks/refresh', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = process.env.HEALTH_MONITOR_URL

  beforeAll(() => {
    process.env.HEALTH_MONITOR_URL = 'http://localhost:3010'
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
    process.env.HEALTH_MONITOR_URL = originalEnv
  })

  it('forwards refresh request to health-monitor and returns results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ service: 'api', status: 'healthy' }] }),
    } as unknown as Response)

    const res = await app.request('/api/admin/health-checks/refresh', {
      method: 'POST',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as { results: unknown }
    expect(data.results).toEqual([{ service: 'api', status: 'healthy' }])
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3010/refresh',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns 502 when health-monitor is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const res = await app.request('/api/admin/health-checks/refresh', {
      method: 'POST',
      headers: { Cookie: adminCookie() },
    })

    expect(res.status).toBe(502)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Health monitor unavailable')
  })

  it('returns 400 for invalid service', async () => {
    globalThis.fetch = vi.fn()

    const res = await app.request('/api/admin/health-checks/refresh', {
      method: 'POST',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'invalid-service' }),
    })

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid service')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('returns 503 when HEALTH_MONITOR_URL is missing', async () => {
    const previousUrl = process.env.HEALTH_MONITOR_URL
    delete process.env.HEALTH_MONITOR_URL
    globalThis.fetch = vi.fn()

    try {
      const res = await app.request('/api/admin/health-checks/refresh', {
        method: 'POST',
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

  it('returns 502 when health-monitor returns a non-OK response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as unknown as Response)

    const res = await app.request('/api/admin/health-checks/refresh', {
      method: 'POST',
      headers: { Cookie: adminCookie() },
    })

    expect(res.status).toBe(502)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Health monitor returned an error')
  })

  it('forwards { service: "api" } body to health-monitor', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ service: 'api', status: 'healthy' }] }),
    } as unknown as Response)

    const res = await app.request('/api/admin/health-checks/refresh', {
      method: 'POST',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'api' }),
    })

    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3010/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ service: 'api' }),
      })
    )
  })

  it('returns 400 for invalid JSON body', async () => {
    globalThis.fetch = vi.fn()

    const res = await app.request('/api/admin/health-checks/refresh', {
      method: 'POST',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
      body: 'not-json',
    })

    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('Invalid JSON body')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('returns 401 for unauthenticated requests', async () => {
    globalThis.fetch = vi.fn()

    const res = await app.request('/api/admin/health-checks/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
