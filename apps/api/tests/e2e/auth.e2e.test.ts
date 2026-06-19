import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, loginAdmin, tenantRequest, adminRequest, json, app } from './fixtures.js'
import type { TestFixture } from './fixtures.js'
import { createMember } from 'db/tenant'

let fixture: TestFixture

describe('E2E auth', () => {
  beforeAll(async () => {
    fixture = await seedE2E()
  })

  afterAll(async () => {
    await cleanupE2E(fixture)
  })

  it('logs in a tenant owner and sets an access token cookie', async () => {
    const cookies = await loginTenant(fixture.owner.email, fixture.owner.password)
    expect(cookies).toContain('tenant_access_token=')
  })

  it('rejects invalid tenant credentials', async () => {
    const res = await tenantRequest('POST', '/api/login', '', fixture.company, {
      email: fixture.owner.email,
      password: 'wrong-password',
    })
    expect(res.status).toBe(401)
  })

  it('registers a new account', async () => {
    const res = await app.request('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `new-${fixture.namespace}@test.co`, password: 'TestPass123!', name: 'New User' }),
    })
    expect(res.status).toBe(200)
    const body = await json<{ ok: boolean; companies: unknown[] }>(res)
    expect(body.ok).toBe(true)
    expect(body.companies).toHaveLength(0)
  })

  it('selects a company and sets tenant session', async () => {
    const cookies = await loginTenant(fixture.owner.email, fixture.owner.password)
    const res = await tenantRequest('POST', '/api/company', cookies, fixture.company, {
      companyId: fixture.company.id,
      slug: fixture.company.slug,
    })
    expect(res.status).toBe(200)
    const body = await json<{ ok: boolean }>(res)
    expect(body.ok).toBe(true)
  })

  it('rejects company selection without a platform session', async () => {
    const res = await app.request('/api/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: fixture.company.id, slug: fixture.company.slug }),
    })
    expect(res.status).toBe(401)
  })

  it('logs out a tenant', async () => {
    const cookies = await loginTenant(fixture.owner.email, fixture.owner.password)
    const res = await tenantRequest('POST', '/api/logout', cookies, fixture.company)
    expect(res.status).toBe(200)
  })

  it('logs in an admin', async () => {
    const cookies = await loginAdmin(fixture.platformAdmin.email, fixture.platformAdmin.password)
    expect(cookies).toContain('admin_access_token=')
  })

  it('checks admin me', async () => {
    const cookies = await loginAdmin(fixture.platformAdmin.email, fixture.platformAdmin.password)
    const res = await adminRequest('GET', '/api/admin/me', cookies)
    expect(res.status).toBe(200)
    const body = await json<{ authenticated: boolean; user: { userId: string } }>(res)
    expect(body.authenticated).toBe(true)
    expect(body.user.userId).toBe(fixture.platformAdmin.id)
  })

  it('logs out an admin', async () => {
    const cookies = await loginAdmin(fixture.platformAdmin.email, fixture.platformAdmin.password)
    const res = await adminRequest('POST', '/api/admin/logout', cookies)
    expect(res.status).toBe(200)
  })

  it('accepts an invite', async () => {
    const pending = await createMember(fixture.namespace, {
      email: `invited-${fixture.namespace}@test.co`,
      role: 'member',
      status: 'pending',
      inviteCode: `invite-${fixture.namespace}`,
    })
    const res = await app.request('/api/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: `invite-${fixture.namespace}`,
        companySlug: fixture.company.slug,
        email: `invited-${fixture.namespace}@test.co`,
        password: 'TestPass123!',
        name: 'Invited User',
      }),
    })
    expect(res.status).toBe(200)
    const body = await json<{ ok: boolean; member: { id: string; status: string } }>(res)
    expect(body.ok).toBe(true)
    expect(body.member.id).toBe(pending.id)
    expect(body.member.status).toBe('active')
  })
})
