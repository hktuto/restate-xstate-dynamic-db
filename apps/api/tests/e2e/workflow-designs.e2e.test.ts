import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, tenantRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture
let seededDesign!: { id: string; name: string }

describe('E2E workflow designs', () => {
  beforeAll(async () => {
    fixture = await seedE2E()
    const cookies = await ownerCookies()
    const res = await tenantRequest('POST', '/api/workflow-designs', cookies, fixture.company, {
      name: 'Seeded Approval Flow',
      xstateConfig: {},
    })
    if (res.status !== 200) {
      throw new Error(`Failed to seed workflow design: ${res.status}`)
    }
    seededDesign = await json<{ id: string; name: string }>(res)
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

  async function adminCookies() {
    const cookies = await loginTenant(fixture.admin.email, fixture.admin.password)
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

  async function createDesign(cookies: string, name: string) {
    const res = await tenantRequest('POST', '/api/workflow-designs', cookies, fixture.company, {
      name,
      xstateConfig: {},
    })
    expect(res.status).toBe(200)
    return json<{ id: string; name: string }>(res)
  }

  it('creates a workflow design', async () => {
    const design = await createDesign(await ownerCookies(), 'Approval Flow')
    expect(design.name).toBe('Approval Flow')
  })

  it('lists workflow designs', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('GET', '/api/workflow-designs', cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string }[]>(res)
    expect(Array.isArray(body)).toBe(true)
    const found = body.find((d) => d.id === seededDesign.id)
    expect(found).toBeDefined()
    expect(found!.name).toBe(seededDesign.name)
  })

  it('gets a workflow design by id', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('GET', `/api/workflow-designs/${seededDesign.id}`, cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string }>(res)
    expect(body.id).toBe(seededDesign.id)
    expect(body.name).toBe(seededDesign.name)
  })

  it('updates a workflow design', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('PATCH', `/api/workflow-designs/${seededDesign.id}`, cookies, fixture.company, {
      name: 'Seeded Approval Flow Updated',
    })
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string }>(res)
    expect(body.id).toBe(seededDesign.id)
    expect(body.name).toBe('Seeded Approval Flow Updated')
    seededDesign.name = body.name
  })

  it('deletes a workflow design', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('DELETE', `/api/workflow-designs/${seededDesign.id}`, cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ ok: boolean }>(res)
    expect(body.ok).toBe(true)

    const listRes = await tenantRequest('GET', '/api/workflow-designs', cookies, fixture.company)
    expect(listRes.status).toBe(200)
    const list = await json<{ id: string }[]>(listRes)
    expect(list.find((d) => d.id === seededDesign.id)).toBeUndefined()
  })

  it('admin user can create a workflow design', async () => {
    const design = await createDesign(await adminCookies(), 'Admin Approval Flow')
    expect(design.name).toBe('Admin Approval Flow')
  })

  it('plain member cannot create workflow designs', async () => {
    const cookies = await memberCookies()
    const res = await tenantRequest('POST', '/api/workflow-designs', cookies, fixture.company, {
      name: 'Should Fail',
    })
    expect(res.status).toBe(403)
  })

  it('plain member cannot update workflow designs', async () => {
    const ownerCookiesVal = await ownerCookies()
    const design = await createDesign(ownerCookiesVal, 'Member Patch Target')
    const cookies = await memberCookies()
    const res = await tenantRequest('PATCH', `/api/workflow-designs/${design.id}`, cookies, fixture.company, {
      name: 'Should Fail',
    })
    expect(res.status).toBe(403)
  })

  it('plain member cannot delete workflow designs', async () => {
    const ownerCookiesVal = await ownerCookies()
    const design = await createDesign(ownerCookiesVal, 'Member Delete Target')
    const cookies = await memberCookies()
    const res = await tenantRequest('DELETE', `/api/workflow-designs/${design.id}`, cookies, fixture.company)
    expect(res.status).toBe(403)
  })
})
