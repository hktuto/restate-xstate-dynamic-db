import { randomUUID } from 'node:crypto'
import { hashPassword } from 'shared'
import { getSurreal, closeSurreal } from 'db/client'
import { createCompany, createUserProfile, createAccount } from 'db/platform'
import { createMember } from 'db/tenant'
import { provisionDefaultCompanyGroups, assignPermissionGroup } from 'db/permissions'
import { provisionCompanyNamespace } from 'db/provision'
import { createUserGroup, addUserGroupMember } from 'db/user-groups'
import { createApp } from '../../src/app.js'

const RESERVED_NAMESPACES = new Set(['platform'])

function assertValidNamespace(namespace: string): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(namespace)) {
    throw new Error(`Invalid namespace: ${namespace}`)
  }
}

function assertSafeNamespace(namespace: string): void {
  assertValidNamespace(namespace)
  if (RESERVED_NAMESPACES.has(namespace)) {
    throw new Error(`Refusing to remove reserved namespace: ${namespace}`)
  }
}

function normalizeRecordId(value: unknown): string {
  if (value === null || value === undefined) {
    throw new Error('Missing record id')
  }
  if (typeof value === 'string') return value
  const obj = value as { toString?: () => string; tb?: string; id?: string | { toString?: () => string } }
  if (typeof obj.toString === 'function') {
    const str = obj.toString()
    if (str && str !== '[object Object]') return str
  }
  if (obj.tb) {
    const idPart = typeof obj.id === 'string' ? obj.id : (obj.id as { toString?: () => string })?.toString?.()
    if (idPart) return `${obj.tb}:${idPart}`
  }
  throw new Error(`Unsupported record id value: ${JSON.stringify(value)}`)
}

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
  role: 'owner' | 'admin' | 'member'
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
    assertSafeNamespace(namespace)
    try {
      await deleteCompanyByNamespace(namespace)
    } catch {
      // best-effort cleanup; ignore failures
    }
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
      platformAdminId = normalizeRecordId(rows[0].id)
    } finally {
      await closeSurreal(adminSurreal)
    }

    async function createUser(role: 'owner' | 'admin' | 'member', prefix: string): Promise<SeededUser> {
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
      return { email, password, profileId: profile.id, accountId: account.id, memberId: normalizeRecordId(member.id), role }
    }

    const owner = await createUser('owner', 'owner')
    const admin = await createUser('admin', 'admin')
    const member = await createUser('member', 'member')

    await provisionDefaultCompanyGroups(company.namespace, owner.memberId)

    const tenantSurreal = await getSurreal(company.namespace, 'main')
    let adminGroupId: string
    let adminPermissionGroupId: string | undefined
    try {
      const [groupRows] = await tenantSurreal.query<[{ id: string }[]]>(
        'SELECT id FROM user_groups WHERE name = $name LIMIT 1',
        { name: 'Admins' }
      )
      const adminGroup = groupRows[0]
      adminGroupId = adminGroup ? normalizeRecordId(adminGroup.id) : (await createUserGroup(company.namespace, { name: 'Admins' })).id

      const [permRows] = await tenantSurreal.query<[{ id: string }[]]>(
        'SELECT id FROM permission_groups WHERE name = $name AND resourceType = $resourceType LIMIT 1',
        { name: 'Admin', resourceType: 'company' }
      )
      adminPermissionGroupId = permRows[0] ? normalizeRecordId(permRows[0].id) : undefined
    } finally {
      await closeSurreal(tenantSurreal)
    }
    await addUserGroupMember(company.namespace, admin.memberId, adminGroupId)
    if (adminPermissionGroupId) {
      await assignPermissionGroup(company.namespace, admin.memberId, adminPermissionGroupId)
    }

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

async function deleteCompanyByNamespace(namespace: string) {
  assertSafeNamespace(namespace)
  try {
    const platform = await getSurreal('platform', 'admin')
    try {
      await platform.query('DELETE companies WHERE namespace = $namespace', { namespace })
    } finally {
      await closeSurreal(platform)
    }
  } catch (err) {
    console.warn('deleteCompanyByNamespace failed:', err)
  }
}

export async function cleanupTestCompany(companyId: string | undefined | null) {
  if (!companyId) return
  try {
    const platform = await getSurreal('platform', 'admin')
    try {
      await platform.query('DELETE type::record($id)', { id: companyId })
    } finally {
      await closeSurreal(platform)
    }
  } catch (err) {
    console.warn('cleanupTestCompany failed:', err)
  }
}

export async function cleanupTestNamespace(namespace: string | undefined | null) {
  if (!namespace) return
  assertSafeNamespace(namespace)
  try {
    const root = await getSurreal()
    try {
      await root.query(`REMOVE NAMESPACE IF EXISTS ${namespace}`)
    } finally {
      await closeSurreal(root)
    }
  } catch (err) {
    console.warn('cleanupTestNamespace failed:', err)
  }
}

async function deletePlatformAdmin(userId: string | undefined | null) {
  if (!userId) return
  try {
    const platform = await getSurreal('platform', 'admin')
    try {
      await platform.query('DELETE type::record($id)', { id: userId })
    } finally {
      await closeSurreal(platform)
    }
  } catch (err) {
    console.warn('deletePlatformAdmin failed:', err)
  }
}

export async function cleanupE2E(fixture: TestFixture | undefined | null) {
  if (!fixture) return
  await deleteCompanyByNamespace(fixture.company.namespace)
  await deletePlatformAdmin(fixture.platformAdmin.id)
  await cleanupTestNamespace(fixture.namespace)
}

function parseCookieValue(raw: string): { name: string; value: string; cleared: boolean } | undefined {
  const parts = raw.split(';').map((p) => p.trim())
  const [nameValue] = parts
  const eq = nameValue.indexOf('=')
  if (eq < 0) return undefined
  const name = nameValue.slice(0, eq)
  const value = nameValue.slice(eq + 1)

  const isCleared =
    value === '' ||
    parts.some((p) => {
      const m = p.match(/^Max-Age\s*=\s*(.+)/i)
      if (!m) return false
      return Number(m[1]) <= 0
    }) ||
    parts.some((p) => {
      const m = p.match(/^Expires\s*=\s*(.+)/i)
      if (!m) return false
      return new Date(m[1]).getTime() < Date.now()
    })

  return { name, value, cleared: isCleared }
}

function collectCookies(res: Response): string {
  const raw: string[] =
    (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
    (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : [])

  if (raw.length === 0) throw new Error('Login did not set cookie')

  const byName = new Map<string, string>()
  for (const r of raw) {
    const parsed = parseCookieValue(r)
    if (!parsed) continue
    if (parsed.cleared) {
      byName.delete(parsed.name)
      continue
    }
    byName.set(parsed.name, `${parsed.name}=${parsed.value}`)
  }

  if (byName.size === 0) throw new Error('Login did not set a usable cookie')
  return Array.from(byName.values()).join('; ')
}

export async function loginTenant(email: string, password: string): Promise<string> {
  const res = await app.request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.text().catch(() => '')
  if (!res.ok) throw new Error(`Tenant login failed: ${res.status} ${body}`)
  return collectCookies(res)
}

export async function loginAdmin(email: string, password: string): Promise<string> {
  const res = await app.request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.text().catch(() => '')
  if (!res.ok) throw new Error(`Admin login failed: ${res.status} ${body}`)
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
