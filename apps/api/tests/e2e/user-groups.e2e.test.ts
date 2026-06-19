import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, tenantRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture

describe('E2E user groups', () => {
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

  it('creates a group', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('POST', '/api/user-groups', cookies, fixture.company, {
      name: 'Engineering',
      description: 'Engineering team',
    })
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string }>(res)
    expect(body.name).toBe('Engineering')
  })

  it('lists groups', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('GET', '/api/user-groups', cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ id: string }[]>(res)
    expect(body.length).toBeGreaterThan(0)
  })

  it('adds and removes a member', async () => {
    const cookies = await ownerCookies()
    const createRes = await tenantRequest('POST', '/api/user-groups', cookies, fixture.company, {
      name: 'Temporary Group',
    })
    const group = await json<{ id: string }>(createRes)

    const addRes = await tenantRequest('POST', `/api/user-groups/${group.id}/members`, cookies, fixture.company, {
      memberId: fixture.member.memberId,
    })
    expect(addRes.status).toBe(200)

    const listRes = await tenantRequest('GET', `/api/user-groups/${group.id}/members`, cookies, fixture.company)
    const members = await json<{ id: string }[]>(listRes)
    expect(members.map((m) => m.id)).toContain(fixture.member.memberId)

    const removeRes = await tenantRequest(
      'DELETE',
      `/api/user-groups/${group.id}/members/${fixture.member.memberId}`,
      cookies,
      fixture.company
    )
    expect(removeRes.status).toBe(200)
  })

  it('rejects group creation by plain member', async () => {
    const cookies = await memberCookies()
    const res = await tenantRequest('POST', '/api/user-groups', cookies, fixture.company, {
      name: 'Should Fail',
    })
    expect(res.status).toBe(403)
  })
})
