import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, tenantRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture
let createdGroup: { id: string; name: string } | undefined
let adminGroupId: string | undefined

describe('E2E user groups', () => {
  beforeAll(async () => {
    fixture = await seedE2E()
    const cookies = await ownerCookies()
    const res = await tenantRequest('GET', '/api/user-groups', cookies, fixture.company)
    const groups = await json<{ id: string; name: string }[]>(res)
    adminGroupId = groups.find((g) => g.name === 'Admins')?.id
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
    createdGroup = { id: body.id, name: body.name }
  })

  it('lists groups', async () => {
    if (!createdGroup) throw new Error('Created group not available')
    const cookies = await ownerCookies()
    const res = await tenantRequest('GET', '/api/user-groups', cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string }[]>(res)
    expect(body.length).toBeGreaterThan(0)
    expect(body.some((g) => g.id === createdGroup!.id && g.name === createdGroup!.name)).toBe(true)
  })

  it('updates a group', async () => {
    if (!createdGroup) throw new Error('Created group not available')
    const cookies = await ownerCookies()
    const res = await tenantRequest('PATCH', `/api/user-groups/${createdGroup.id}`, cookies, fixture.company, {
      name: 'Engineering Updated',
    })
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string }>(res)
    expect(body.id).toBe(createdGroup.id)
    expect(body.name).toBe('Engineering Updated')
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
    const cookies = await memberCookies()
    const res = await tenantRequest('POST', '/api/user-groups', cookies, fixture.company, {
      name: 'Should Fail',
    })
    expect(res.status).toBe(403)
  })

  it('rejects group update by plain member', async () => {
    if (!adminGroupId) throw new Error('Admins group not found')
    const cookies = await memberCookies()
    const res = await tenantRequest('PATCH', `/api/user-groups/${adminGroupId}`, cookies, fixture.company, {
      name: 'Should Fail',
    })
    expect(res.status).toBe(403)
  })

  it('rejects group deletion by plain member', async () => {
    if (!adminGroupId) throw new Error('Admins group not found')
    const cookies = await memberCookies()
    const res = await tenantRequest('DELETE', `/api/user-groups/${adminGroupId}`, cookies, fixture.company)
    expect(res.status).toBe(403)
  })

  it('rejects member addition by plain member', async () => {
    if (!adminGroupId) throw new Error('Admins group not found')
    const cookies = await memberCookies()
    const res = await tenantRequest('POST', `/api/user-groups/${adminGroupId}/members`, cookies, fixture.company, {
      memberId: fixture.member.memberId,
    })
    expect(res.status).toBe(403)
  })

  it('rejects member removal by plain member', async () => {
    if (!adminGroupId) throw new Error('Admins group not found')
    const cookies = await memberCookies()
    const res = await tenantRequest(
      'DELETE',
      `/api/user-groups/${adminGroupId}/members/${fixture.member.memberId}`,
      cookies,
      fixture.company
    )
    expect(res.status).toBe(403)
  })
})
