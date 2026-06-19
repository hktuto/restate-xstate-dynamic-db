import { randomUUID } from 'node:crypto'
import { hashPassword } from 'shared'
import { getSurreal, closeSurreal } from 'db/client'
import { createCompany, createUserProfile, createAccount } from 'db/platform'
import { createMember } from 'db/tenant'
import { provisionDefaultCompanyGroups } from 'db/permissions'
import { provisionCompanyNamespace } from 'db/provision'
import { createUserGroup, addUserGroupMember } from 'db/user-groups'
import { createApp } from '../../src/app.js'

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-secret'
}

export const app = createApp()

export interface SeededUser {
  email: string
  password: string
  profileId: string
  accountId: string
  memberId: string
  role: 'owner' | 'member'
}

export interface TestFixture {
  namespace: string
  company: { id: string; name: string; slug: string; namespace: string }
  owner: SeededUser
  admin: SeededUser
  member: SeededUser
  platformAdmin: { email: string; password: string; id: string }
}

export async function seedE2E(): Promise<TestFixture> {
  const suffix = `${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`
  const ns = `e2e_${suffix}`
  const password = 'TestPass123!'
  let fixture: TestFixture | undefined

  async function cleanupPartial(namespace: string | undefined) {
    if (!namespace) return
    const root = await getSurreal()
    try {
      await root.query(`REMOVE NAMESPACE IF EXISTS ${namespace}`)
    } catch {
      // best-effort cleanup; ignore failures
    } finally {
      await closeSurreal(root)
    }
  }

  try {
    const root = await getSurreal()
    try {
      await root.query(`
        DEFINE NAMESPACE IF NOT EXISTS platform;
        USE NS platform DB admin;
        DEFINE DATABASE IF NOT EXISTS admin;
      `)
    } finally {
      await closeSurreal(root)
    }

    const company = await createCompany({ name: 'E2E Test Co', slug: ns, namespace: ns })
    await provisionCompanyNamespace(company.namespace)

    const adminSurreal = await getSurreal('platform', 'admin')
    let platformAdminId: string
    try {
      const [rows] = await adminSurreal.query<[{ id: string }[]]>(
        'CREATE platform_users CONTENT $data RETURN id',
        { data: { email: `platform-admin-${suffix}@test.co`, password: await hashPassword(password) } }
      )
      platformAdminId = rows[0].id
    } finally {
      await closeSurreal(adminSurreal)
    }

    async function createUser(role: 'owner' | 'member', prefix: string): Promise<SeededUser> {
      const email = `${prefix}-${suffix}@test.co`
      const profile = await createUserProfile({ name: prefix })
      const account = await createAccount({
        provider: 'email',
        providerKey: email,
        credential: await hashPassword(password),
        profileId: profile.id,
      })
      const member = await createMember(company.namespace, {
        email,
        role,
        status: 'active',
        profileId: profile.id,
        inviteCode: null,
      })
      return { email, password, profileId: profile.id, accountId: account.id, memberId: member.id, role }
    }

    const owner = await createUser('owner', 'owner')
    const admin = await createUser('member', 'admin')
    const member = await createUser('member', 'member')

    await provisionDefaultCompanyGroups(company.namespace, owner.memberId)

    const tenantSurreal = await getSurreal(company.namespace, 'main')
    let adminGroupId: string
    try {
      const [rows] = await tenantSurreal.query<[{ id: string }[]]>(
        'SELECT id FROM user_groups WHERE name = $name LIMIT 1',
        { name: 'Admins' }
      )
      const adminGroup = rows[0]
      adminGroupId = adminGroup ? adminGroup.id : (await createUserGroup(company.namespace, { name: 'Admins' })).id
    } finally {
      await closeSurreal(tenantSurreal)
    }
    await addUserGroupMember(company.namespace, admin.memberId, adminGroupId)

    fixture = {
      namespace: company.namespace,
      company,
      owner,
      admin,
      member,
      platformAdmin: { email: `platform-admin-${suffix}@test.co`, password, id: platformAdminId },
    }
  } catch (e) {
    await cleanupPartial(ns)
    throw e
  }

  return fixture
}

export async function cleanupE2E(fixture: TestFixture | undefined | null) {
  if (!fixture) return
  const root = await getSurreal()
  try {
    await root.query(`REMOVE NAMESPACE IF EXISTS ${fixture.namespace}`)
  } finally {
    await closeSurreal(root)
  }
}

function collectCookies(res: Response): string {
  const all = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.()
  if (all && all.length > 0) return all.join('; ')
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) return setCookie
  throw new Error('Login did not set cookie')
}

export async function loginTenant(email: string, password: string): Promise<string> {
  const res = await app.request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`Tenant login failed: ${res.status} ${await res.text()}`)
  return collectCookies(res)
}

export async function loginAdmin(email: string, password: string): Promise<string> {
  const res = await app.request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`Admin login failed: ${res.status} ${await res.text()}`)
  return collectCookies(res)
}

export function companyCookie(company: { id: string; slug: string; namespace: string }): string {
  return `company=${encodeURIComponent(JSON.stringify({ id: company.id, slug: company.slug, namespace: company.namespace }))}`
}

export async function json<T = unknown>(res: Response): Promise<T> {
  return res.json() as Promise<T>
}

export async function tenantRequest(
  method: string,
  path: string,
  cookies: string,
  company: { id: string; slug: string; namespace: string },
  body?: unknown
): Promise<Response> {
  const parts = [cookies, companyCookie(company)].filter(Boolean)
  const headers: Record<string, string> = {
    Cookie: parts.join('; '),
  }
  const init: RequestInit = { method, headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  return app.request(path, init)
}

export async function adminRequest(
  method: string,
  path: string,
  cookies: string,
  body?: unknown
): Promise<Response> {
  const headers: Record<string, string> = { Cookie: cookies }
  const init: RequestInit = { method, headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  return app.request(path, init)
}
