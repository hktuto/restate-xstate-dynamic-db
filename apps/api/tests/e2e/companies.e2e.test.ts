import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, tenantRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture

describe('E2E companies', () => {
  beforeAll(async () => {
    fixture = await seedE2E()
  })

  afterAll(async () => {
    await cleanupE2E(fixture)
  })

  it('creates a company', async () => {
    const cookies = await loginTenant(fixture.owner.email, fixture.owner.password)
    const res = await tenantRequest('POST', '/api/companies', cookies, fixture.company, {
      name: 'New E2E Company',
    })
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string; slug: string }>(res)
    expect(body.name).toBe('New E2E Company')
  })

  it('lists companies for the current profile', async () => {
    const cookies = await loginTenant(fixture.owner.email, fixture.owner.password)
    await tenantRequest('POST', '/api/company', cookies, fixture.company, {
      companyId: fixture.company.id,
      slug: fixture.company.slug,
    })
    const res = await tenantRequest('GET', '/api/companies', cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ id: string }[]>(res)
    expect(body.some((c) => c.id === fixture.company.id)).toBe(true)
  })
})
