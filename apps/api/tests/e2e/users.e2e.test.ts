import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, tenantRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture

describe('E2E users', () => {
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

  async function memberCookies() {
    const cookies = await loginTenant(fixture.member.email, fixture.member.password)
    await tenantRequest('POST', '/api/company', cookies, fixture.company, {
      companyId: fixture.company.id,
      slug: fixture.company.slug,
    })
    return cookies
  }

  it('lists users', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('GET', '/api/users', cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ id: string }[]>(res)
    expect(body.length).toBeGreaterThanOrEqual(3)
  })

  it('invites a new member', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('POST', '/api/users', cookies, fixture.company, {
      email: `invitee-${fixture.namespace}@test.co`,
      role: 'member',
    })
    expect(res.status).toBe(200)
    const body = await json<{ id: string; email: string }>(res)
    expect(body.email).toBe(`invitee-${fixture.namespace}@test.co`)
  })

  it('rejects invite for plain member', async () => {
    const cookies = await memberCookies()
    const res = await tenantRequest('POST', '/api/users', cookies, fixture.company, {
      email: `should-fail-${fixture.namespace}@test.co`,
      role: 'member',
    })
    expect(res.status).toBe(403)
  })

  it('updates a member role', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('PATCH', `/api/users/${fixture.member.memberId}`, cookies, fixture.company, {
      role: 'owner',
    })
    expect(res.status).toBe(200)
    const body = await json<{ ok: boolean }>(res)
    expect(body.ok).toBe(true)
  })

  it('blocks self-demotion', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('PATCH', `/api/users/${fixture.owner.memberId}`, cookies, fixture.company, {
      role: 'member',
    })
    expect(res.status).toBe(400)
  })

  it('removes a member', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('DELETE', `/api/users/${fixture.member.memberId}`, cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ ok: boolean }>(res)
    expect(body.ok).toBe(true)
  })
})
