import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, tenantRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture
let testGroup: { id: string; name: string } | undefined
let permissionTestGroup: { id: string; name: string } | undefined

describe('E2E user groups', () => {
  beforeAll(async () => {
    fixture = await seedE2E()
    const cookies = await ownerCookies()

    const testRes = await tenantRequest('POST', '/api/user-groups', cookies, fixture.company, {
      name: 'Engineering',
      description: 'Engineering team',
    })
    expect(testRes.status).toBe(200)
    const testBody = await json<{ id: string; name: string }>(testRes)
    testGroup = { id: testBody.id, name: testBody.name }

    const permRes = await tenantRequest('POST', '/api/user-groups', cookies, fixture.company, {
      name: 'Permission Test Group',
      description: 'Group for permission denial tests',
    })
    expect(permRes.status).toBe(200)
    const permBody = await json<{ id: string; name: string }>(permRes)
    permissionTestGroup = { id: permBody.id, name: permBody.name }

    // Seed owner membership so the member-remove rejection has a stable post-condition.
    const addOwnerRes = await tenantRequest(
      'POST',
      `/api/user-groups/${permissionTestGroup.id}/members`,
      cookies,
      fixture.company,
      { memberId: fixture.owner.memberId }
    )
    expect(addOwnerRes.status).toBe(200)
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
      name: 'Engineering Alpha',
      description: 'Engineering team',
    })
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string }>(res)
    expect(body.name).toBe('Engineering Alpha')
  })

  it('lists groups', async () => {
    if (!testGroup) throw new Error('Test group not available')
    const cookies = await ownerCookies()
    const res = await tenantRequest('GET', '/api/user-groups', cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string }[]>(res)
    expect(body.length).toBeGreaterThan(0)
    const group = body.find((g) => g.id === testGroup!.id)
    expect(group).toBeDefined()
    expect(group!.name).toBe(testGroup!.name)
  })

  it('updates a group', async () => {
    if (!testGroup) throw new Error('Test group not available')
    const cookies = await ownerCookies()
    const res = await tenantRequest('PATCH', `/api/user-groups/${testGroup.id}`, cookies, fixture.company, {
      name: 'Engineering Updated',
    })
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string }>(res)
    expect(body.id).toBe(testGroup.id)
    expect(body.name).toBe('Engineering Updated')
    testGroup.name = body.name
  })

  it('deletes a group', async () => {
    const cookies = await ownerCookies()
    const createRes = await tenantRequest('POST', '/api/user-groups', cookies, fixture.company, {
      name: 'Group to Delete',
    })
    expect(createRes.status).toBe(200)
    const group = await json<{ id: string }>(createRes)

    const deleteRes = await tenantRequest('DELETE', `/api/user-groups/${group.id}`, cookies, fixture.company)
    expect(deleteRes.status).toBe(200)
    const deleteBody = await json<{ ok: boolean }>(deleteRes)
    expect(deleteBody.ok).toBe(true)

    const listRes = await tenantRequest('GET', '/api/user-groups', cookies, fixture.company)
    expect(listRes.status).toBe(200)
    const groups = await json<{ id: string }[]>(listRes)
    expect(groups.map((g) => g.id)).not.toContain(group.id)
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
    expect(listRes.status).toBe(200)
    const members = await json<{ id: string }[]>(listRes)
    expect(members.map((m) => m.id)).toContain(fixture.member.memberId)

    const removeRes = await tenantRequest(
      'DELETE',
      `/api/user-groups/${group.id}/members/${fixture.member.memberId}`,
      cookies,
      fixture.company
    )
    expect(removeRes.status).toBe(200)

    const afterRes = await tenantRequest('GET', `/api/user-groups/${group.id}/members`, cookies, fixture.company)
    expect(afterRes.status).toBe(200)
    const afterMembers = await json<{ id: string }[]>(afterRes)
    expect(afterMembers.map((m) => m.id)).not.toContain(fixture.member.memberId)
  })

  it('rejects group creation by plain member', async () => {
    const attemptName = 'Should Fail Create'
    const cookies = await memberCookies()
    const res = await tenantRequest('POST', '/api/user-groups', cookies, fixture.company, {
      name: attemptName,
    })
    expect(res.status).toBe(403)

    const ownerCookiesVal = await ownerCookies()
    const listRes = await tenantRequest('GET', '/api/user-groups', ownerCookiesVal, fixture.company)
    expect(listRes.status).toBe(200)
    const groups = await json<{ name: string }[]>(listRes)
    expect(groups.some((g) => g.name === attemptName)).toBe(false)
  })

  it('rejects group update by plain member', async () => {
    if (!permissionTestGroup) throw new Error('Permission test group not available')
    const cookies = await memberCookies()
    const res = await tenantRequest('PATCH', `/api/user-groups/${permissionTestGroup.id}`, cookies, fixture.company, {
      name: 'Should Fail Update',
    })
    expect(res.status).toBe(403)

    const ownerCookiesVal = await ownerCookies()
    const listRes = await tenantRequest('GET', '/api/user-groups', ownerCookiesVal, fixture.company)
    expect(listRes.status).toBe(200)
    const groups = await json<{ id: string; name: string }[]>(listRes)
    const group = groups.find((g) => g.id === permissionTestGroup!.id)
    expect(group).toBeDefined()
    expect(group!.name).toBe(permissionTestGroup!.name)
  })

  it('rejects group deletion by plain member', async () => {
    if (!permissionTestGroup) throw new Error('Permission test group not available')
    const cookies = await memberCookies()
    const res = await tenantRequest('DELETE', `/api/user-groups/${permissionTestGroup.id}`, cookies, fixture.company)
    expect(res.status).toBe(403)

    const ownerCookiesVal = await ownerCookies()
    const listRes = await tenantRequest('GET', '/api/user-groups', ownerCookiesVal, fixture.company)
    expect(listRes.status).toBe(200)
    const groups = await json<{ id: string }[]>(listRes)
    expect(groups.map((g) => g.id)).toContain(permissionTestGroup!.id)
  })

  it('rejects member addition by plain member', async () => {
    if (!permissionTestGroup) throw new Error('Permission test group not available')
    const cookies = await memberCookies()
    const res = await tenantRequest(
      'POST',
      `/api/user-groups/${permissionTestGroup.id}/members`,
      cookies,
      fixture.company,
      { memberId: fixture.member.memberId }
    )
    expect(res.status).toBe(403)

    const ownerCookiesVal = await ownerCookies()
    const membersRes = await tenantRequest(
      'GET',
      `/api/user-groups/${permissionTestGroup.id}/members`,
      ownerCookiesVal,
      fixture.company
    )
    expect(membersRes.status).toBe(200)
    const members = await json<{ id: string }[]>(membersRes)
    expect(members.map((m) => m.id)).not.toContain(fixture.member.memberId)
  })

  it('rejects member removal by plain member', async () => {
    if (!permissionTestGroup) throw new Error('Permission test group not available')
    const cookies = await memberCookies()
    const res = await tenantRequest(
      'DELETE',
      `/api/user-groups/${permissionTestGroup.id}/members/${fixture.owner.memberId}`,
      cookies,
      fixture.company
    )
    expect(res.status).toBe(403)

    const ownerCookiesVal = await ownerCookies()
    const membersRes = await tenantRequest(
      'GET',
      `/api/user-groups/${permissionTestGroup.id}/members`,
      ownerCookiesVal,
      fixture.company
    )
    expect(membersRes.status).toBe(200)
    const members = await json<{ id: string }[]>(membersRes)
    expect(members.map((m) => m.id)).toContain(fixture.owner.memberId)
  })
})
