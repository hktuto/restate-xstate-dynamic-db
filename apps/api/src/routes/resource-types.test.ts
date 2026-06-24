import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../app.js'
import { getSurreal, closeSurreal } from 'db/client'
import { provisionCompanyNamespace } from 'db/provision'
import { seed } from 'db/seed'

process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-session-secret-32bytes-long'

describe('resource-types routes', () => {
  const app = createApp()
  const testNs = `test_api_rt_${Date.now()}`
  let adminCookie = ''

  async function adminLogin() {
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@example.com', password: 'admin' }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(200)
    adminCookie = res.headers.getSetCookie().join('; ')
  }

  beforeAll(async () => {
    await seed()
    await provisionCompanyNamespace(testNs)
    await adminLogin()
  }, 60000)

  afterAll(async () => {
    const surreal = await getSurreal()
    try {
      await surreal.query(`REMOVE NAMESPACE IF EXISTS ${testNs}`)
      await surreal.query('REMOVE NAMESPACE IF EXISTS platform')
    } finally {
      await closeSurreal(surreal)
    }
  }, 30000)

  it('lists admin resource types', async () => {
    const res = await app.request('/api/admin/resource-types/platform--admin', {
      headers: { Cookie: adminCookie },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as any[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.some((r: any) => r.name === 'admin_user')).toBe(true)
  })

  it('gets an admin resource type by name', async () => {
    const res = await app.request('/api/admin/resource-types/platform--admin/admin_user', {
      headers: { Cookie: adminCookie },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.name).toBe('admin_user')
    expect(body.table).toBe('platform_users')
    expect(Array.isArray(body.bitMapping)).toBe(true)
  })

  it('returns 404 for unknown admin resource type', async () => {
    const res = await app.request('/api/admin/resource-types/platform--admin/not_a_resource', {
      headers: { Cookie: adminCookie },
    })
    expect(res.status).toBe(404)
  })
})
