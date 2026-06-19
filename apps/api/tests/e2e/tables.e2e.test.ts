import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, loginAdmin, tenantRequest, adminRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture

describe('E2E tables', () => {
  beforeAll(async () => {
    fixture = await seedE2E()
  })

  afterAll(async () => {
    await cleanupE2E(fixture)
  })

  async function ownerCookies() {
    const cookies = await loginTenant(fixture.owner.email, fixture.owner.password)
    await tenantRequest('POST', '/api/company', cookies, fixture.company, {
      companyId: fixture.company.id,
      slug: fixture.company.slug,
    })
    return cookies
  }

  it('lists tenant tables', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('GET', '/api/tables', cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ name: string }[]>(res)
    expect(body.some((t) => t.name === 'members')).toBe(true)
  })

  it('queries tenant table records', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('POST', '/api/tables/members/query', cookies, fixture.company, {
      page: 1,
      pageSize: 10,
    })
    expect(res.status).toBe(200)
    const body = await json<{ records: unknown[]; total: number }>(res)
    expect(body.records.length).toBeGreaterThanOrEqual(3)
    expect(typeof body.total).toBe('number')
  })

  it('admin queries a company namespace table', async () => {
    const cookies = await loginAdmin(fixture.platformAdmin.email, fixture.platformAdmin.password)
    const nsdb = `${fixture.namespace}--main`
    const res = await adminRequest('POST', `/api/admin/tables/${nsdb}/members/query`, cookies, {
      page: 1,
      pageSize: 10,
    })
    expect(res.status).toBe(200)
    const body = await json<{ records: unknown[] }>(res)
    expect(body.records.length).toBeGreaterThanOrEqual(3)
  })

  it('rejects invalid admin nsdb format', async () => {
    const cookies = await loginAdmin(fixture.platformAdmin.email, fixture.platformAdmin.password)
    const res = await adminRequest('GET', '/api/admin/tables/invalid/members', cookies)
    expect(res.status).toBe(400)
  })
})
