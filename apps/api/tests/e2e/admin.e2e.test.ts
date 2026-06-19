import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginAdmin, adminRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture

describe('E2E admin', () => {
  beforeAll(async () => {
    fixture = await seedE2E()
  })

  afterAll(async () => {
    await cleanupE2E(fixture)
  })

  async function adminCookies() {
    return loginAdmin(fixture.platformAdmin.email, fixture.platformAdmin.password)
  }

  it('returns dashboard counts', async () => {
    const cookies = await adminCookies()
    const res = await adminRequest('GET', '/api/admin/dashboard', cookies)
    expect(res.status).toBe(200)
    const body = await json<{ companies: number; workflowDesigns: number; triggers: number }>(res)
    expect(typeof body.companies).toBe('number')
  })

  it('returns health checks', async () => {
    const cookies = await adminCookies()
    const res = await adminRequest('GET', '/api/admin/health-checks', cookies)
    expect(res.status).toBe(200)
    const body = await json<{ latest: unknown[] }>(res)
    expect(Array.isArray(body.latest)).toBe(true)
  })

  it('returns health history for surrealdb', async () => {
    const cookies = await adminCookies()
    const res = await adminRequest('GET', '/api/admin/health-checks/history?service=surrealdb&limit=5', cookies)
    expect(res.status).toBe(200)
    const body = await json<{ service: string; limit: number; history: unknown[] }>(res)
    expect(body.service).toBe('surrealdb')
  })

  it('CRUD admin workflow designs', async () => {
    const cookies = await adminCookies()
    const createRes = await adminRequest('POST', '/api/admin/workflow-designs', cookies, {
      name: 'Platform Flow',
      xstateConfig: {},
    })
    expect(createRes.status).toBe(200)
    const design = await json<{ id: string; name: string }>(createRes)
    expect(design.name).toBe('Platform Flow')

    const listRes = await adminRequest('GET', '/api/admin/workflow-designs', cookies)
    expect(listRes.status).toBe(200)

    const patchRes = await adminRequest('PATCH', `/api/admin/workflow-designs/${design.id}`, cookies, {
      name: 'Platform Flow Updated',
    })
    expect(patchRes.status).toBe(200)

    const deleteRes = await adminRequest('DELETE', `/api/admin/workflow-designs/${design.id}`, cookies)
    expect(deleteRes.status).toBe(200)
  })

  it('rejects admin endpoints without session', async () => {
    const res = await adminRequest('GET', '/api/admin/dashboard', '')
    expect(res.status).toBe(401)
  })
})
