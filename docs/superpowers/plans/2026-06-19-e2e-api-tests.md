> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

# E2E API Tests Implementation Plan

**Goal:** Add a comprehensive end-to-end API test suite under `apps/api/tests/e2e/` that exercises auth, companies, users, user groups, permissions, tables, workflow designs, and admin endpoints through the real Hono app and a live SurrealDB.

**Architecture:** A shared `fixtures.ts` seeds one test company with owner, admin-group member, and plain member users, plus a platform admin. Tests perform real logins and pass returned cookies to subsequent requests. Each test file cleans up its namespace in `afterAll`.

**Tech Stack:** TypeScript, Vitest, Hono, SurrealDB, `shared` password hashing.

---

## File map

| File | Responsibility |
|---|---|
| `apps/api/tests/e2e/fixtures.ts` | Shared seed data, login helpers, request wrappers, cleanup. |
| `apps/api/tests/e2e/auth.e2e.test.ts` | Login, register, logout, company selection, accept invite, admin login/logout. |
| `apps/api/tests/e2e/companies.e2e.test.ts` | Create and list companies. |
| `apps/api/tests/e2e/users.e2e.test.ts` | List, invite, update, and delete members. |
| `apps/api/tests/e2e/user-groups.e2e.test.ts` | User group CRUD and membership. |
| `apps/api/tests/e2e/permissions.e2e.test.ts` | Permission actions and effective permission checks. |
| `apps/api/tests/e2e/tables.e2e.test.ts` | Tenant and admin table queries. |
| `apps/api/tests/e2e/workflow-designs.e2e.test.ts` | Tenant workflow design CRUD and role restrictions. |
| `apps/api/tests/e2e/admin.e2e.test.ts` | Admin dashboard, health checks, admin workflow designs. |

---

## Task 1: Shared fixtures

**Files:**
- Create: `apps/api/tests/e2e/fixtures.ts`

### Step 1: Create the shared fixture module

Create `apps/api/tests/e2e/fixtures.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { hashPassword } from 'shared'
import { getSurreal, closeSurreal } from 'db/client'
import { createCompany, createUserProfile, createAccount } from 'db/platform'
import { createMember } from 'db/tenant'
import { provisionDefaultCompanyGroups } from 'db/permissions'
import { provisionCompanyNamespace } from 'db/provision'
import { createApp } from '../../src/app.js'

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

  const company = await createCompany({ name: 'E2E Test Co', slug: ns })
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
  try {
    const [rows] = await tenantSurreal.query<[{ id: string }[]]>(
      'SELECT id FROM user_groups WHERE name = $name LIMIT 1',
      { name: 'Admins' }
    )
    const adminGroup = rows[0]
    if (adminGroup) {
      await tenantSurreal.query(
        'RELATE $member->user_group_memberships->$group',
        { member: admin.memberId, group: adminGroup.id }
      )
    }
  } finally {
    await closeSurreal(tenantSurreal)
  }

  return {
    namespace: company.namespace,
    company,
    owner,
    admin,
    member,
    platformAdmin: { email: `platform-admin-${suffix}@test.co`, password, id: platformAdminId },
  }
}

export async function cleanupE2E(fixture: TestFixture) {
  const root = await getSurreal()
  try {
    await root.query(`REMOVE NAMESPACE IF EXISTS ${fixture.namespace}`)
  } finally {
    await closeSurreal(root)
  }
}

function collectCookies(res: Response): string {
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) return setCookie
  const all = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.()
  if (all && all.length > 0) return all.join('; ')
  throw new Error('Login did not set cookie')
}

export async function loginTenant(email: string, password: string): Promise<string> {
  const res = await app.request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`Tenant login failed: ${res.status}`)
  return collectCookies(res)
}

export async function loginAdmin(email: string, password: string): Promise<string> {
  const res = await app.request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`Admin login failed: ${res.status}`)
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
  const headers: Record<string, string> = {
    Cookie: `${cookies}; ${companyCookie(company)}`,
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
```

### Step 2: Commit

```bash
git add apps/api/tests/e2e/fixtures.ts
git commit -m "test(api): shared E2E fixtures and helpers"
```

---

## Task 2: Auth E2E tests

**Files:**
- Create: `apps/api/tests/e2e/auth.e2e.test.ts`

### Step 1: Write the auth test file

Create `apps/api/tests/e2e/auth.e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, loginAdmin, tenantRequest, adminRequest, json } from './fixtures.js'
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

  it('logs in a tenant owner and returns companies', async () => {
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
```

### Step 2: Run auth tests

```bash
cd D:/work/restate-xstate
pnpm --filter api test auth.e2e.test.ts
```

Expected: all tests pass.

### Step 3: Commit

```bash
git add apps/api/tests/e2e/auth.e2e.test.ts
git commit -m "test(api): E2E auth tests"
```

---

## Task 3: Companies E2E tests

**Files:**
- Create: `apps/api/tests/e2e/companies.e2e.test.ts`

### Step 1: Write the companies test file

Create `apps/api/tests/e2e/companies.e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, cleanupTestNamespace, cleanupTestCompany, loginTenant, tenantRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture
let createdCompany: { id: string; slug: string; namespace: string } | undefined

describe('E2E companies', () => {
  beforeAll(async () => {
    fixture = await seedE2E()
  })

  afterAll(async () => {
    await cleanupE2E(fixture)
    if (createdCompany) {
      await cleanupTestCompany(createdCompany.id)
      await cleanupTestNamespace(createdCompany.namespace)
    }
  })

  it('creates a company', async () => {
    const cookies = await loginTenant(fixture.owner.email, fixture.owner.password)
    const res = await tenantRequest('POST', '/api/companies', cookies, fixture.company, {
      name: 'New E2E Company',
    })
    expect(res.status).toBe(200)
    const body = await json<{ id: string; name: string; slug: string; namespace: string }>(res)
    createdCompany = { id: body.id, slug: body.slug, namespace: body.namespace }
    expect(body.name).toBe('New E2E Company')
  })

  it('lists companies for the current profile', async () => {
    const cookies = await loginTenant(fixture.owner.email, fixture.owner.password)
    await tenantRequest('POST', '/api/company', cookies, fixture.company, {
      companyId: fixture.company.id,
      slug: fixture.company.slug,
    })
    const res = await tenantRequest('GET', '/api/companies', cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ id: string }[]>(res)
    expect(body.some((c) => c.id === fixture.company.id)).toBe(true)
  })
})
```

### Step 2: Commit

```bash
git add apps/api/tests/e2e/companies.e2e.test.ts
git commit -m "test(api): E2E companies tests"
```

---

## Task 4: Users E2E tests

**Files:**
- Create: `apps/api/tests/e2e/users.e2e.test.ts`

### Step 1: Write the users test file

Create `apps/api/tests/e2e/users.e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, tenantRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture
let invitedMemberId: string | undefined

describe('E2E users', () => {
  beforeAll(async () => {
    fixture = await seedE2E()
  })

  afterAll(async () => {
    await cleanupE2E(fixture)
  })

  afterEach(async () => {
    // Ensure the seeded member is restored to role 'member' after mutating tests.
    const cookies = await ownerCookies()
    const res = await tenantRequest('GET', '/api/users', cookies, fixture.company)
    if (res.status !== 200) {
      console.warn(`E2E users afterEach reset: GET /api/users returned ${res.status}`)
      return
    }
    const members = await json<Array<{ id: string; role: string }>>(res)
    const member = members.find((m) => m.id === fixture.member.memberId)
    if (member && member.role !== 'member') {
      await tenantRequest('PATCH', `/api/users/${fixture.member.memberId}`, cookies, fixture.company, { role: 'member' })
    }
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
    invitedMemberId = body.id
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
    expect(res.status).toBe(403)
  })

  it('rejects member role update by plain member', async () => {
    const cookies = await memberCookies()
    const res = await tenantRequest('PATCH', `/api/users/${fixture.member.memberId}`, cookies, fixture.company, {
      role: 'owner',
    })
    expect(res.status).toBe(403)
  })

  it('rejects member removal by plain member', async () => {
    const cookies = await memberCookies()
    const res = await tenantRequest('DELETE', `/api/users/${fixture.owner.memberId}`, cookies, fixture.company)
    expect(res.status).toBe(403)
  })

  it('removes a member', async () => {
    const cookies = await ownerCookies()
    const id = invitedMemberId ?? fixture.member.memberId
    const res = await tenantRequest('DELETE', `/api/users/${id}`, cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ ok: boolean }>(res)
    expect(body.ok).toBe(true)
  })
})
```

### Step 2: Commit

```bash
git add apps/api/tests/e2e/users.e2e.test.ts
git commit -m "test(api): E2E users tests"
```

---

## Task 5: User Groups E2E tests

**Files:**
- Create: `apps/api/tests/e2e/user-groups.e2e.test.ts`

### Step 1: Write the user groups test file

Create `apps/api/tests/e2e/user-groups.e2e.test.ts`:

```ts
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

    // Deterministic group used by list, update, and permission tests.
    const testRes = await tenantRequest('POST', '/api/user-groups', cookies, fixture.company, {
      name: 'Engineering',
      description: 'Engineering team',
    })
    expect(testRes.status).toBe(200)
    const testBody = await json<{ id: string; name: string }>(testRes)
    testGroup = { id: testBody.id, name: testBody.name }

    // Separate group reserved for negative permission tests.
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
```

### Step 2: Commit

```bash
git add apps/api/tests/e2e/user-groups.e2e.test.ts
git commit -m "test(api): E2E user groups tests"
```

---

## Task 6: Permissions E2E tests

**Files:**
- Create: `apps/api/tests/e2e/permissions.e2e.test.ts`

### Step 1: Write the permissions test file

Create `apps/api/tests/e2e/permissions.e2e.test.ts`:

```ts
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

  async function ownerCookies() {
    const cookies = await loginTenant(fixture.owner.email, fixture.owner.password)
    const selectRes = await tenantRequest('POST', '/api/company', cookies, fixture.company, {
      companyId: fixture.company.id,
      slug: fixture.company.slug,
    })
    expect(selectRes.status).toBe(200)
    return cookies
  }

  async function memberCookies() {
    const cookies = await loginTenant(fixture.member.email, fixture.member.password)
    const selectRes = await tenantRequest('POST', '/api/company', cookies, fixture.company, {
      companyId: fixture.company.id,
      slug: fixture.company.slug,
    })
    expect(selectRes.status).toBe(200)
    return cookies
  }

  it('lists permission actions for company', async () => {
    const cookies = await ownerCookies()
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
```

### Step 2: Commit

```bash
git add apps/api/tests/e2e/permissions.e2e.test.ts
git commit -m "test(api): E2E permissions tests"
```

---

## Task 7: Tables E2E tests

**Files:**
- Create: `apps/api/tests/e2e/tables.e2e.test.ts`

### Step 1: Write the tables test file

Create `apps/api/tests/e2e/tables.e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginTenant, loginAdmin, tenantRequest, adminRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture

describe('E2E tables', () => {
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

  it('lists tenant tables', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('GET', '/api/tables', cookies, fixture.company)
    expect(res.status).toBe(200)
    const body = await json<{ name: string }[]>(res)
    expect(body.some((t) => t.name === 'members')).toBe(true)
  })

  it('queries tenant table records', async () => {
    const cookies = await ownerCookies()
    const res = await tenantRequest('POST', '/api/tables/members/query', cookies, fixture.company, {
      page: 1,
      pageSize: 10,
    })
    expect(res.status).toBe(200)
    const body = await json<{ records: unknown[]; total: number }>(res)
    expect(body.records.length).toBeGreaterThanOrEqual(3)
    expect(typeof body.total).toBe('number')
  })

  it('admin queries a company namespace table', async () => {
    const cookies = await loginAdmin(fixture.platformAdmin.email, fixture.platformAdmin.password)
    const nsdb = `${fixture.namespace}--main`
    const res = await adminRequest('POST', `/api/admin/tables/${nsdb}/members/query`, cookies, {
      page: 1,
      pageSize: 10,
    })
    expect(res.status).toBe(200)
    const body = await json<{ records: unknown[] }>(res)
    expect(body.records.length).toBeGreaterThanOrEqual(3)
  })

  it('rejects invalid admin nsdb format', async () => {
    const cookies = await loginAdmin(fixture.platformAdmin.email, fixture.platformAdmin.password)
    const res = await adminRequest('GET', '/api/admin/tables/invalid/members', cookies)
    expect(res.status).toBe(400)
  })
})
```

### Step 2: Commit

```bash
git add apps/api/tests/e2e/tables.e2e.test.ts
git commit -m "test(api): E2E tables tests"
```

---

## Task 8: Workflow Designs E2E tests

**Files:**
- Create: `apps/api/tests/e2e/workflow-designs.e2e.test.ts`

### Step 1: Write the workflow designs test file

Create `apps/api/tests/e2e/workflow-designs.e2e.test.ts`:

```ts
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
```

### Step 2: Commit

```bash
git add apps/api/tests/e2e/workflow-designs.e2e.test.ts
git commit -m "test(api): E2E workflow designs tests"
```

---

## Task 9: Admin E2E tests

**Files:**
- Create: `apps/api/tests/e2e/admin.e2e.test.ts`

### Step 1: Write the admin test file

Create `apps/api/tests/e2e/admin.e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seedE2E, cleanupE2E, loginAdmin, adminRequest, json } from './fixtures.js'
import type { TestFixture } from './fixtures.js'

let fixture: TestFixture

describe('E2E admin', () => {
  beforeAll(async () => {
    fixture = await seedE2E()
  })

  afterAll(async () => {
    await cleanupE2E(fixture)
  })

  async function adminCookies() {
    return loginAdmin(fixture.platformAdmin.email, fixture.platformAdmin.password)
  }

  it('returns dashboard counts', async () => {
    const cookies = await adminCookies()
    const res = await adminRequest('GET', '/api/admin/dashboard', cookies)
    expect(res.status).toBe(200)
    const body = await json<{ companies: number; workflowDesigns: number; triggers: number }>(res)
    expect(typeof body.companies).toBe('number')
  })

  it('returns health checks', async () => {
    const cookies = await adminCookies()
    const res = await adminRequest('GET', '/api/admin/health-checks', cookies)
    expect(res.status).toBe(200)
    const body = await json<{ latest: unknown[] }>(res)
    expect(Array.isArray(body.latest)).toBe(true)
  })

  it('returns health history for surrealdb', async () => {
    const cookies = await adminCookies()
    const res = await adminRequest('GET', '/api/admin/health-checks/history?service=surrealdb&limit=5', cookies)
    expect(res.status).toBe(200)
    const body = await json<{ service: string; limit: number; history: unknown[] }>(res)
    expect(body.service).toBe('surrealdb')
  })

  it('CRUD admin workflow designs', async () => {
    const cookies = await adminCookies()
    const createRes = await adminRequest('POST', '/api/admin/workflow-designs', cookies, {
      name: 'Platform Flow',
      xstateConfig: {},
    })
    expect(createRes.status).toBe(200)
    const design = await json<{ id: string; name: string }>(createRes)
    expect(design.name).toBe('Platform Flow')

    const listRes = await adminRequest('GET', '/api/admin/workflow-designs', cookies)
    expect(listRes.status).toBe(200)

    const patchRes = await adminRequest('PATCH', `/api/admin/workflow-designs/${design.id}`, cookies, {
      name: 'Platform Flow Updated',
    })
    expect(patchRes.status).toBe(200)

    const deleteRes = await adminRequest('DELETE', `/api/admin/workflow-designs/${design.id}`, cookies)
    expect(deleteRes.status).toBe(200)
  })

  it('rejects admin endpoints without session', async () => {
    const res = await adminRequest('GET', '/api/admin/dashboard', '')
    expect(res.status).toBe(401)
  })
})
```

### Step 2: Commit

```bash
git add apps/api/tests/e2e/admin.e2e.test.ts
git commit -m "test(api): E2E admin tests"
```

---

## Task 10: Full E2E suite verification

### Step 1: Run the entire E2E suite

```bash
cd D:/work/restate-xstate
pnpm --filter api test
```

Expected: all E2E tests pass alongside existing unit/integration tests.

### Step 2: Fix any failures

If any test fails, adjust the fixture or test assertion and rerun. Common issues:
- Race conditions in parallel namespace creation → ensure unique namespace suffix.
- Cookie encoding → `tenantRequest` already URL-encodes the company cookie; login cookies come directly from Hono.
- Permission expectations → verify the seeded admin user is correctly added to the default `Admins` group.

### Step 3: Final commit

```bash
git add apps/api/tests/e2e/
git commit -m "test(api): complete E2E API test suite"
```

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| Real tenant login | Task 2 |
| Real admin login | Task 2 |
| Register, logout, company selection, accept invite | Task 2 |
| Create/list companies | Task 3 |
| List/invite/update/delete users | Task 4 |
| User group CRUD + membership | Task 5 |
| Permission actions + member restrictions | Task 6 |
| Tenant/admin table queries | Task 7 |
| Workflow design CRUD + role restrictions | Task 8 |
| Admin dashboard, health, admin workflow designs | Task 9 |
| Cleanup and full suite pass | Task 10 |

No placeholders are used; every task includes complete file contents and exact commands.
