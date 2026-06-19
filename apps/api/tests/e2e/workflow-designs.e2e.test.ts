import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, tenantRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture

describe('E2E workflow designs', () => {
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

  it('creates a workflow design', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('POST', '/api/workflow-designs', cookies, fixture.company, {
      name: 'Approval Flow',
      xstateConfig: {},
    })
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string }>(res)
    expect(body.name).toBe('Approval Flow')
  })

  it('lists workflow designs', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('GET', '/api/workflow-designs', cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ id: string }[]>(res)
    expect(Array.isArray(body)).toBe(true)
  })

  it('plain member cannot create workflow designs', async () => {
    const cookies = await memberCookies()
    const res = await tenantRequest('POST', '/api/workflow-designs', cookies, fixture.company, {
      name: 'Should Fail',
    })
    expect(res.status).toBe(403)
  })
})
