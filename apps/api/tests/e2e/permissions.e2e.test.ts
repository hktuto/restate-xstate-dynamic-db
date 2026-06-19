import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, tenantRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture

describe('E2E permissions', () => {
  beforeAll(async () => {
    fixture = await seedE2E()
  })

  afterAll(async () => {
    await cleanupE2E(fixture)
  })

  async function memberCookies() {
    const cookies = await loginTenant(fixture.member.email, fixture.member.password)
    await tenantRequest('POST', '/api/company', cookies, fixture.company, {
      companyId: fixture.company.id,
      slug: fixture.company.slug,
    })
    return cookies
  }

  it('lists permission actions for company', async () => {
    const cookies = await loginTenant(fixture.owner.email, fixture.owner.password)
    await tenantRequest('POST', '/api/company', cookies, fixture.company, {
      companyId: fixture.company.id,
      slug: fixture.company.slug,
    })
    const res = await tenantRequest('GET', '/api/permissions/actions?resourceType=company', cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ resourceType: string; actions: unknown[] }>(res)
    expect(body.resourceType).toBe('company')
    expect(body.actions.length).toBeGreaterThan(0)
  })

  it('member cannot invite users', async () => {
    const cookies = await memberCookies()
    const res = await tenantRequest('POST', '/api/users', cookies, fixture.company, {
      email: `no-perm-${fixture.namespace}@test.co`,
      role: 'member',
    })
    expect(res.status).toBe(403)
  })
})
