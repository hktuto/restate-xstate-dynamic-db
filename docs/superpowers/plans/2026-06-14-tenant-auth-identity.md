---
title: Tenant Authentication & Identity Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Data Model]]
  - [[Company Management]]
  - [[30-Apps/Web App/Overview]]
---

# Tenant Authentication & Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split tenant user identity into global `account`/`user_profile` tables and per-company `member` tables, enabling multi-provider login and cross-company membership with an invite-by-code flow.

**Architecture:** Authentication credentials live in the `platform` namespace (`accounts` table), profile/preference data lives in the `platform` namespace (`user_profiles` table), and company membership/roles live in each company namespace (`members` table). The web app resolves the company via cookie/header, then resolves the active member from the session.

**Tech Stack:** TypeScript, SurrealDB, bcryptjs (via `shared`), Nuxt 4, H3.

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/db/src/platform.ts` | Global `account` and `user_profile` CRUD + lookups. |
| `packages/db/src/tenant.ts` | Per-company `member` CRUD + invite lookups. |
| `packages/db/src/provision.ts` | Define tenant namespace indexes for `members`. |
| `packages/db/src/seed.ts` | Define global namespace indexes for `accounts` and `user_profiles`. |
| `packages/shared/src/auth.ts` | Existing bcrypt helpers; add provider constant. |
| `apps/web/server/utils/auth.ts` | Tenant session cookie helpers. |
| `apps/web/server/middleware/member.ts` | Resolve active `member` from session + company. |
| `apps/web/server/api/auth/login.post.ts` | Email/password login for a company. |
| `apps/web/server/api/users/index.get.ts` | List company members with profile join. |
| `apps/web/server/api/users/index.post.ts` | Invite a new member by email. |
| `apps/web/server/api/users/accept-invite.post.ts` | Accept invite and create/claim account + profile. |
| `apps/web/server/api/users/[id].patch.ts` | Update member role/status or linked profile. |
| `apps/web/server/api/users/[id].delete.ts` | Remove a member. |
| `apps/web/app/pages/users/index.vue` | Display member list and invite form. |

---

## Task 1: Seed global auth indexes

**Files:**
- Modify: `packages/db/src/seed.ts`

- [ ] **Step 1: Add `accounts` and `user_profiles` table/index definitions**

Replace the existing `UPSERT platform_users:admin` block with the same block plus new `DEFINE TABLE`/`DEFINE INDEX` statements for `accounts` and `user_profiles`.

```typescript
import { hashPassword } from 'shared'
import { getSurreal, closeSurreal } from './client.js'

async function seed() {
  const surreal = await getSurreal()
  try {
    const passwordHash = await hashPassword('admin')
    await surreal.query(`
      DEFINE NAMESPACE IF NOT EXISTS platform;
      USE NS platform DB admin;
      DEFINE DATABASE IF NOT EXISTS admin;
      USE NS platform DB admin;
      DEFINE TABLE IF NOT EXISTS companies SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS platform_users SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS accounts SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS user_profiles SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_companies_slug ON companies FIELDS slug UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_accounts_provider_key ON accounts FIELDS provider, providerKey UNIQUE;

      UPSERT platform_users:admin SET email = 'admin@example.com', password = $password;
    `, { password: passwordHash })
    console.log('Platform namespace seeded')
  } finally {
    await closeSurreal(surreal)
  }
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Verify seed compiles**

Run: `pnpm --filter db build`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "db: define global account and user_profile tables/indexes"
```

---

## Task 2: Add `account` and `user_profile` CRUD in `platform.ts`

**Files:**
- Modify: `packages/db/src/platform.ts`

- [ ] **Step 1: Append global identity types and functions**

Add the following at the end of `packages/db/src/platform.ts` (after `getCompanyByNamespace`).

```typescript
export interface UserProfileRecord {
  id: string
  name: string
  gender?: string
  birthday?: string
  preferences?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface UserProfileInput {
  name: string
  gender?: string
  birthday?: string
  preferences?: Record<string, unknown>
}

export async function createUserProfile(input: UserProfileInput): Promise<UserProfileRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data = {
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[UserProfileRecord[]]>(
      'CREATE user_profiles CONTENT $data',
      { data }
    )
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getUserProfileById(id: string): Promise<UserProfileRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[UserProfileRecord[]]>(
      'SELECT * FROM user_profiles WHERE id = $id LIMIT 1',
      { id }
    )
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateUserProfile(
  id: string,
  input: Partial<UserProfileInput>
): Promise<UserProfileRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data = {
      ...input,
      updatedAt: new Date().toISOString()
    }
    const [updated] = await surreal.query<[UserProfileRecord[]]>(
      'UPDATE $id CONTENT $data',
      { id, data }
    )
    return updated[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export type AuthProvider = 'email' | 'oauth_google' | 'oauth_github' | 'phone'

export interface AccountRecord {
  id: string
  provider: AuthProvider
  providerKey: string
  credential?: string
  profileId: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface AccountInput {
  provider: AuthProvider
  providerKey: string
  credential?: string
  profileId: string
}

export async function createAccount(input: AccountInput): Promise<AccountRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data = {
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[AccountRecord[]]>(
      'CREATE accounts CONTENT $data',
      { data }
    )
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getAccountByProviderKey(
  provider: AuthProvider,
  providerKey: string
): Promise<AccountRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[AccountRecord[]]>(
      'SELECT * FROM accounts WHERE provider = $provider AND providerKey = $providerKey LIMIT 1',
      { provider, providerKey }
    )
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateAccountCredential(
  id: string,
  credential: string
): Promise<AccountRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [updated] = await surreal.query<[AccountRecord[]]>(
      'UPDATE $id SET credential = $credential, updatedAt = $updatedAt',
      { id, credential, updatedAt: new Date().toISOString() }
    )
    return updated[0]
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 2: Build db package**

Run: `pnpm --filter db build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/platform.ts
git commit -m "db: add account and user_profile CRUD"
```

---

## Task 3: Replace tenant `users` with `members`

**Files:**
- Modify: `packages/db/src/tenant.ts`
- Modify: `packages/db/src/provision.ts`

- [ ] **Step 1: Remove `UserRecord`/`UserInput`/`users` CRUD and add `member` CRUD**

In `packages/db/src/tenant.ts`, delete lines defining `UserRecord`, `UserInput`, `listUsers`, `createUser`, `updateUser`, `deleteUser`, `getUserById`. Replace them with:

```typescript
export interface MemberRecord {
  id: string
  profileId?: string
  email: string
  role: 'owner' | 'admin' | 'member'
  status: 'pending' | 'active' | 'inactive'
  inviteCode?: string
  joinedAt?: string
  invitedBy?: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface MemberInput {
  email: string
  role: 'owner' | 'admin' | 'member'
  status?: 'pending' | 'active' | 'inactive'
  inviteCode?: string
  invitedBy?: string
}

export async function listMembers(namespace: string): Promise<MemberRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [members] = await surreal.query<[MemberRecord[]]>('SELECT * FROM members')
    return members
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createMember(namespace: string, input: MemberInput): Promise<MemberRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data = {
      ...input,
      status: input.status ?? 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[MemberRecord[]]>('CREATE members CONTENT $data', { data })
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getMemberById(namespace: string, id: string): Promise<MemberRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[MemberRecord[]]>(
      'SELECT * FROM members WHERE id = $id LIMIT 1',
      { id }
    )
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getMemberByProfileId(
  namespace: string,
  profileId: string
): Promise<MemberRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[MemberRecord[]]>(
      'SELECT * FROM members WHERE profileId = $profileId LIMIT 1',
      { profileId }
    )
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getMemberByInviteCode(
  namespace: string,
  inviteCode: string
): Promise<MemberRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[MemberRecord[]]>(
      'SELECT * FROM members WHERE inviteCode = $inviteCode LIMIT 1',
      { inviteCode }
    )
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateMember(
  namespace: string,
  id: string,
  input: Partial<MemberInput>
): Promise<MemberRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data = {
      ...input,
      updatedAt: new Date().toISOString()
    }
    const [updated] = await surreal.query<[MemberRecord[]]>(
      'UPDATE $id CONTENT $data',
      { id, data }
    )
    return updated[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deleteMember(namespace: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query('DELETE $id', { id })
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 2: Add member indexes in provision.ts**

Modify `packages/db/src/provision.ts` to define `members` table and indexes when a company namespace is provisioned.

```typescript
export async function provisionCompanyNamespace(namespace: string) {
  const surreal = await getSurreal()
  try {
    await surreal.query(`
      DEFINE NAMESPACE IF NOT EXISTS ${namespace};
      USE NS ${namespace} DB main;
      DEFINE DATABASE IF NOT EXISTS main;
      USE NS ${namespace} DB main;
      DEFINE TABLE IF NOT EXISTS _tables SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS _columns SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS _relations SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS members SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_members_profileId ON members FIELDS profileId;
      DEFINE INDEX IF NOT EXISTS idx_members_inviteCode ON members FIELDS inviteCode UNIQUE;
    `)
    return { ok: true, namespace }
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 3: Build db package**

Run: `pnpm --filter db build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/tenant.ts packages/db/src/provision.ts
git commit -m "db: replace tenant users with members and invite indexes"
```

---

## Task 4: Add tenant session helpers

**Files:**
- Create: `apps/web/server/utils/auth.ts`

- [ ] **Step 1: Create session utilities**

```typescript
import type { H3Event } from 'h3'

export interface TenantSession {
  accountId: string
  profileId: string
  companyId: string
  memberId: string
  role: 'owner' | 'admin' | 'member'
}

const TENANT_SESSION_COOKIE = 'tenant_session'

export function setTenantSession(event: H3Event, session: TenantSession) {
  setCookie(event, TENANT_SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 // 1 day
  })
}

export function getTenantSession(event: H3Event): TenantSession | null {
  const cookie = getCookie(event, TENANT_SESSION_COOKIE)
  if (!cookie) return null
  try {
    return JSON.parse(cookie) as TenantSession
  } catch {
    return null
  }
}

export function requireTenantSession(event: H3Event): TenantSession {
  const session = getTenantSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}

export function clearTenantSession(event: H3Event) {
  deleteCookie(event, TENANT_SESSION_COOKIE)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/utils/auth.ts
git commit -m "web: add tenant session cookie helpers"
```

---

## Task 5: Add member-resolution middleware

**Files:**
- Create: `apps/web/server/middleware/member.ts`

- [ ] **Step 1: Resolve active member from session**

```typescript
import { getMemberByProfileId } from 'db/tenant'
import { getTenantSession } from '#server/utils/auth'

declare module 'h3' {
  interface H3EventContext {
    member?: {
      id: string
      role: 'owner' | 'admin' | 'member'
    }
  }
}

export default defineEventHandler(async (event) => {
  const session = getTenantSession(event)
  if (!session || !event.context.company) return

  const member = await getMemberByProfileId(event.context.company.namespace, session.profileId)
  if (member && member.status === 'active') {
    event.context.member = {
      id: member.id,
      role: member.role
    }
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/middleware/member.ts
git commit -m "web: add member resolution middleware"
```

---

## Task 6: Implement tenant login endpoint

**Files:**
- Create: `apps/web/server/api/auth/login.post.ts`

- [ ] **Step 1: Create login handler**

```typescript
import { getAccountByProviderKey, getUserProfileById } from 'db/platform'
import { getMemberByProfileId } from 'db/tenant'
import { comparePassword } from 'shared'
import { setTenantSession } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body || {}

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password required' })
  }

  const account = await getAccountByProviderKey('email', email)
  if (!account || !account.credential) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  if (!(await comparePassword(password, account.credential))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const profile = await getUserProfileById(account.profileId)
  if (!profile) {
    throw createError({ statusCode: 500, statusMessage: 'Profile not found' })
  }

  const company = event.context.company
  if (!company) {
    throw createError({ statusCode: 400, statusMessage: 'Company not resolved' })
  }

  const member = await getMemberByProfileId(company.namespace, profile.id)
  if (!member || member.status !== 'active') {
    throw createError({ statusCode: 403, statusMessage: 'Not a member of this company' })
  }

  setTenantSession(event, {
    accountId: account.id,
    profileId: profile.id,
    companyId: company.id,
    memberId: member.id,
    role: member.role
  })

  return { ok: true }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/api/auth/login.post.ts
git commit -m "web: add tenant email/password login endpoint"
```

---

## Task 7: Rewrite users list API as members list

**Files:**
- Modify: `apps/web/server/api/users/index.get.ts`

- [ ] **Step 1: List members and join profiles**

```typescript
import { listMembers } from 'db/tenant'
import { getUserProfileById } from 'db/platform'

export default defineEventHandler(async (event) => {
  const namespace = event.context.company.namespace
  const members = await listMembers(namespace)
  const profileIds = members.map(m => m.profileId).filter((id): id is string => Boolean(id))
  const uniqueProfileIds = [...new Set(profileIds)]
  const profiles = await Promise.all(uniqueProfileIds.map(id => getUserProfileById(id)))
  const profileMap = new Map(profiles.filter(Boolean).map(p => [p!.id, p!]))

  return members.map(member => ({
    ...member,
    profile: member.profileId ? profileMap.get(member.profileId) ?? null : null
  }))
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/api/users/index.get.ts
git commit -m "web: list members with joined profile data"
```

---

## Task 8: Implement invite creation API

**Files:**
- Modify: `apps/web/server/api/users/index.post.ts`

- [ ] **Step 1: Replace user creation with member invitation**

```typescript
import { createMember } from 'db/tenant'
import { dispatchTrigger } from '#server/utils/dispatch'
import crypto from 'node:crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, role } = body || {}

  if (!email || !role) {
    throw createError({ statusCode: 400, statusMessage: 'Email and role required' })
  }

  const validRoles: Array<'owner' | 'admin' | 'member'> = ['owner', 'admin', 'member']
  if (!validRoles.includes(role)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  }

  const inviteCode = crypto.randomBytes(32).toString('hex')
  const member = await createMember(event.context.company.namespace, {
    email,
    role,
    status: 'pending',
    inviteCode
  })

  await dispatchTrigger(event, 'members', 'create', member)
  return member
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/api/users/index.post.ts
git commit -m "web: invite members by email with random code"
```

---

## Task 9: Implement invite acceptance API

**Files:**
- Create: `apps/web/server/api/users/accept-invite.post.ts`

- [ ] **Step 1: Accept invite and create/claim identity**

```typescript
import { getMemberByInviteCode, updateMember } from 'db/tenant'
import { getAccountByProviderKey, createAccount, createUserProfile } from 'db/platform'
import { hashPassword } from 'shared'
import { setTenantSession } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { inviteCode, email, password, name } = body || {}

  if (!inviteCode || !email || !password || !name) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fields' })
  }

  const company = event.context.company
  if (!company) {
    throw createError({ statusCode: 400, statusMessage: 'Company not resolved' })
  }

  const member = await getMemberByInviteCode(company.namespace, inviteCode)
  if (!member || member.status !== 'pending' || member.email !== email) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid invite' })
  }

  let account = await getAccountByProviderKey('email', email)
  let profileId: string

  if (account) {
    profileId = account.profileId
  } else {
    const profile = await createUserProfile({ name })
    profileId = profile.id
    account = await createAccount({
      provider: 'email',
      providerKey: email,
      credential: await hashPassword(password),
      profileId
    })
  }

  const updated = await updateMember(company.namespace, member.id, {
    profileId,
    status: 'active',
    inviteCode: undefined,
    joinedAt: new Date().toISOString()
  })

  setTenantSession(event, {
    accountId: account.id,
    profileId,
    companyId: company.id,
    memberId: member.id,
    role: member.role
  })

  return { ok: true, member: updated }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/api/users/accept-invite.post.ts
git commit -m "web: add invite acceptance endpoint"
```

---

## Task 10: Update member patch endpoint

**Files:**
- Modify: `apps/web/server/api/users/[id].patch.ts`

- [ ] **Step 1: Update member and/or linked profile**

```typescript
import { updateMember } from 'db/tenant'
import { updateUserProfile } from 'db/platform'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Member id required' })
  }

  const body = await readBody(event)
  const namespace = event.context.company.namespace

  const memberUpdate: Partial<{ role: string; status: string }> = {}
  if (body.role) memberUpdate.role = body.role
  if (body.status) memberUpdate.status = body.status

  if (Object.keys(memberUpdate).length > 0) {
    await updateMember(namespace, id, memberUpdate)
  }

  if (body.profile && body.profileId) {
    await updateUserProfile(body.profileId, body.profile)
  }

  return { ok: true }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/api/users/[id].patch.ts
git commit -m "web: update member role/status and linked profile"
```

---

## Task 11: Update member delete endpoint

**Files:**
- Modify: `apps/web/server/api/users/[id].delete.ts`

- [ ] **Step 1: Delete member by id**

```typescript
import { deleteMember } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Member id required' })
  }
  await deleteMember(event.context.company.namespace, id)
  return { ok: true }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/api/users/[id].delete.ts
git commit -m "web: delete member endpoint"
```

---

## Task 12: Update users UI

**Files:**
- Modify: `apps/web/app/pages/users/index.vue`

- [ ] **Step 1: Read current page**

Read `apps/web/app/pages/users/index.vue` first to see existing fields.

- [ ] **Step 2: Adjust fields for member + profile**

Update the page to:
- Display `member.email`, `member.role`, `member.status`, `profile.name`.
- Show invite form with email + role.
- Optionally show invite link/code for pending members.

Exact markup depends on the current page; keep existing Nuxt UI patterns.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/pages/users/index.vue
git commit -m "web: update users page for member/profile model"
```

---

## Task 13: Build and verify

- [ ] **Step 1: Build all packages and apps**

Run: `pnpm -r build`
Expected: no TypeScript or build errors.

- [ ] **Step 2: Run db seed (if starting fresh)**

Run: `docker compose up -d` then `pnpm --filter db seed`
Expected: platform namespace seeded with new indexes.

- [ ] **Step 3: Manual smoke test**

1. Start web app: `pnpm --filter web dev`
2. Create a company from admin app.
3. POST `/api/users` with email + role → expect pending member with `inviteCode`.
4. POST `/api/users/accept-invite` with invite code, email, password, name → expect `ok: true` and session cookie set.
5. POST `/api/auth/login` with email + password → expect `ok: true`.
6. GET `/api/users` → expect list with joined profile.

- [ ] **Step 4: Commit any fixes**

---

## Task 14: Update documentation

**Files:**
- Create: `docs/50-Features/Authentication & Authorization.md`
- Modify: `docs/20-Architecture/Data Model.md`
- Modify: `docs/00-Atlas/Project Brief.md`

- [ ] **Step 1: Create feature note**

Create `docs/50-Features/Authentication & Authorization.md` with frontmatter:

```markdown
---
title: "Authentication & Authorization"
type: feature
status: in-progress
area: web
app:
  - web
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Data Model]]
  - [[Company Management]]
  - [[30-Apps/Web App/Overview]]
---

# Authentication & Authorization

Tenant users authenticate through global `account` records linked to a single `user_profile`. Each company namespace holds a `member` record that connects the profile to the company and defines role and status.
```

- [ ] **Step 2: Update Data Model note**

In `docs/20-Architecture/Data Model.md`, replace the `users` row under tenant namespace with:

```markdown
| `members` | Company membership, role, invite status. |
```

Add a new section describing global `accounts` and `user_profiles`.

- [ ] **Step 3: Update Project Brief dates**

Update `updated:` in `docs/00-Atlas/Project Brief.md` to today.

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs: update auth and data model notes"
```

---

## Self-review

**Spec coverage:**
- Global `account` table → Task 2.
- Global `user_profile` table → Task 2.
- Per-company `member` table → Task 3.
- Multi-provider support → `AuthProvider` type in Task 2.
- Multi-company membership → global profile + per-company member in Task 3.
- Invite-by-code flow → Tasks 8 and 9.
- Simple role string → `role` type in Task 3.
- JSON cookie session → Task 4.
- No migration → Task 3 removes users functions without migration.
- Company branding overrides → not part of auth redesign; covered by `companies`/`company_settings` out of scope.

**Placeholder scan:**
- No TBD/TODO in core tasks.
- Task 12 references current page markup without full code; this is acceptable because it requires reading the existing UI first.

**Type consistency:**
- `AuthProvider` used in `platform.ts`, `login.post.ts`, and `accept-invite.post.ts`.
- `TenantSession` used in `auth.ts`, `member.ts` middleware, `login.post.ts`, and `accept-invite.post.ts`.
- `MemberRecord.status` values align across `tenant.ts`, `member.ts`, `login.post.ts`, and `accept-invite.post.ts`.
