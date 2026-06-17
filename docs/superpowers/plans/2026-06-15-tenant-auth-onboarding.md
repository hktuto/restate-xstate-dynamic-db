---
title: Tenant Auth & Onboarding Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-16
updated: 2026-06-16
---

# Tenant Auth & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public self-service registration, multi-company membership, signed session cookies, the missing tenant auth pages, and API guards so the web app has a complete onboarding path.

**Architecture:** Split tenant identity (`tenant_session` cookie) from company context (`company` cookie). Sign both tenant and admin session cookies with HMAC. Add a global web auth middleware and reusable API guards. Move company creation from the admin app to the web app.

**Tech Stack:** Nuxt 4, Nitro, SurrealDB via `packages/db`, bcrypt via `packages/shared`, Node crypto for HMAC signing, Vitest for tests.

---

### Task 1: Add `SESSION_SECRET` env var and shared session signing helpers

**Files:**
- Modify: `.env.example`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/session.ts`

- [ ] **Step 1: Add `SESSION_SECRET` to `.env.example`**

```bash
# Sessions
SESSION_SECRET=change-me-in-production
```

- [ ] **Step 2: Write `packages/shared/src/session.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

const SEPARATOR = '.'

function sign(value: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
  const signature = hmac.update(value).digest('hex')
  return `${signature}${SEPARATOR}${value}`
}

export function unsign(signedValue: string, secret: string): string | null {
  const index = signedValue.indexOf(SEPARATOR)
  if (index === -1) return null
  const signature = signedValue.slice(0, index)
  const value = signedValue.slice(index + 1)
  const expected = sign(value, secret).slice(0, index)
  if (signature.length !== expected.length) return null
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? value : null
}

export function signObject<T extends Record<string, unknown>>(obj: T, secret: string): string {
  return sign(JSON.stringify(obj), secret)
}

export function unsignObject<T extends Record<string, unknown>>(signedValue: string, secret: string): T | null {
  const value = unsign(signedValue, secret)
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Export helpers from `packages/shared/src/index.ts`**

Add to the top:

```ts
export * from './session.js'
```

- [ ] **Step 4: Build shared package**

```bash
pnpm --filter shared build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add .env.example packages/shared/src/session.ts packages/shared/src/index.ts
git commit -m "feat(shared): add HMAC session signing helpers"
```

---

### Task 2: Refactor tenant session utilities

**Files:**
- Modify: `apps/web/server/utils/auth.ts`

- [ ] **Step 1: Update `apps/web/server/utils/auth.ts`**

Replace the file contents with:

```ts
import type { H3Event } from 'h3'

export interface TenantSession {
  accountId: string
  profileId: string
}

export interface TenantCompanyCookie {
  id: string
  slug: string
  namespace: string
}

const TENANT_SESSION_COOKIE = 'tenant_session'
const COMPANY_COOKIE = 'company'

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET is required')
  }
  return secret
}

export function setTenantSession(event: H3Event, session: TenantSession) {
  const { signObject } = await import('shared')
  setCookie(event, TENANT_SESSION_COOKIE, signObject(session, getSessionSecret()), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 // 1 day
  })
}

export function getTenantSession(event: H3Event): TenantSession | null {
  const cookie = getCookie(event, TENANT_SESSION_COOKIE)
  if (!cookie) return null
  const { unsignObject } = await import('shared')
  return unsignObject(cookie, getSessionSecret())
}

export function requireTenantSession(event: H3Event): TenantSession {
  const session = getTenantSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}

export function clearTenantSession(event: H3Event) {
  deleteCookie(event, TENANT_SESSION_COOKIE, { path: '/' })
}

export function setTenantCompany(event: H3Event, company: TenantCompanyCookie) {
  setCookie(event, COMPANY_COOKIE, JSON.stringify(company), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24
  })
}

export function getTenantCompany(event: H3Event): TenantCompanyCookie | null {
  const cookie = getCookie(event, COMPANY_COOKIE)
  if (!cookie) return null
  try {
    return JSON.parse(cookie) as TenantCompanyCookie
  } catch {
    return null
  }
}

export function clearTenantCompany(event: H3Event) {
  deleteCookie(event, COMPANY_COOKIE, { path: '/' })
}
```

Note: top-level await import inside functions avoids circular-dependency issues if `shared` dist is not ready during Nuxt type generation.

- [ ] **Step 2: Typecheck web app**

```bash
pnpm --filter web typecheck
```

Expected: may show errors in routes that used the old `TenantSession` shape; those are fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/utils/auth.ts
git commit -m "refactor(web): split tenant session and company cookie; sign session"
```

---

### Task 3: Update tenant login API

**Files:**
- Modify: `apps/web/server/api/auth/login.post.ts`

- [ ] **Step 1: Rewrite `apps/web/server/api/auth/login.post.ts`**

```ts
import { getAccountByProviderKey, getUserProfileById, getCompanyBySlug, listCompaniesForProfile } from 'db/platform'
import { getMemberByProfileId } from 'db/tenant'
import { comparePassword } from 'shared'
import { setTenantSession, clearTenantCompany } from '#server/utils/auth'

const DUMMY_HASH = '$2b$12$8V7kAT3IavmTSYAx187I3.xTeRR6Ujz2G1MZACVrUBbN..wVwSICK'

const loginAttempts = new Map<string, number[]>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const attempts = loginAttempts.get(key) ?? []
  const recent = attempts.filter(t => now - t < WINDOW_MS)
  if (recent.length === 0) {
    loginAttempts.delete(key)
  } else {
    loginAttempts.set(key, recent)
  }
  return recent.length >= MAX_ATTEMPTS
}

function recordAttempt(key: string) {
  const attempts = loginAttempts.get(key) ?? []
  attempts.push(Date.now())
  loginAttempts.set(key, attempts)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body || {}
  const normalizedEmail = email?.trim().toLowerCase()

  if (!normalizedEmail || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password required' })
  }

  if (isRateLimited(normalizedEmail)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts' })
  }

  const account = await getAccountByProviderKey('email', normalizedEmail)
  const hashToCompare = account?.credential ?? DUMMY_HASH

  if (!(await comparePassword(password, hashToCompare))) {
    recordAttempt(normalizedEmail)
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  if (!account || !account.credential) {
    recordAttempt(normalizedEmail)
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const profile = await getUserProfileById(account.profileId)
  if (!profile) {
    throw createError({ statusCode: 500, statusMessage: 'Profile not found' })
  }

  setTenantSession(event, { accountId: account.id, profileId: profile.id })
  clearTenantCompany(event)

  const companies = await listCompaniesForProfile(profile.id)

  return { ok: true, companies }
})
```

- [ ] **Step 2: Add `listCompaniesForProfile` to `packages/db/src/platform.ts`**

Add after `getCompanyByNamespace`:

```ts
export async function listCompaniesForProfile(profileId: string): Promise<CompanyRecord[]> {
  const companies = await listCompanies()
  const memberships = await Promise.all(
    companies.map(async (company) => {
      const surreal = await getSurreal(company.namespace, 'main')
      try {
        const [members] = await surreal.query<[Array<{ id: string }>]>(
          'SELECT id FROM members WHERE profileId = $profileId LIMIT 1',
          { profileId }
        )
        return members.length > 0 ? company : null
      } finally {
        await closeSurreal(surreal)
      }
    })
  )
  return memberships.filter((c): c is CompanyRecord => c !== null)
}
```

- [ ] **Step 3: Build db package**

```bash
pnpm --filter db build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/platform.ts apps/web/server/api/auth/login.post.ts
git commit -m "feat(web): login returns company list and signs session"
```

---

### Task 4: Add tenant register API

**Files:**
- Create: `apps/web/server/api/auth/register.post.ts`

- [ ] **Step 1: Write `apps/web/server/api/auth/register.post.ts`**

```ts
import { getAccountByProviderKey, createAccount, createUserProfile } from 'db/platform'
import { hashPassword } from 'shared'
import { setTenantSession } from '#server/utils/auth'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

const registerAttempts = new Map<string, number[]>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const attempts = registerAttempts.get(key) ?? []
  const recent = attempts.filter(t => now - t < WINDOW_MS)
  if (recent.length === 0) {
    registerAttempts.delete(key)
  } else {
    registerAttempts.set(key, recent)
  }
  return recent.length >= MAX_ATTEMPTS
}

function recordAttempt(key: string) {
  const attempts = registerAttempts.get(key) ?? []
  attempts.push(Date.now())
  registerAttempts.set(key, attempts)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, name } = body || {}

  if (!email || !password || !name) {
    throw createError({ statusCode: 400, statusMessage: 'Email, password, and name required' })
  }

  if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid field types' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const trimmedName = name.trim()

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  }

  if (trimmedName.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Name required' })
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }

  if (isRateLimited(normalizedEmail)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts' })
  }

  const existing = await getAccountByProviderKey('email', normalizedEmail)
  if (existing) {
    recordAttempt(normalizedEmail)
    throw createError({ statusCode: 409, statusMessage: 'Account already exists' })
  }

  const profile = await createUserProfile({ name: trimmedName })
  const account = await createAccount({
    provider: 'email',
    providerKey: normalizedEmail,
    credential: await hashPassword(password),
    profileId: profile.id
  })

  setTenantSession(event, { accountId: account.id, profileId: profile.id })

  return { ok: true, companies: [] }
})
```

- [ ] **Step 2: Typecheck web app**

```bash
pnpm --filter web typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/api/auth/register.post.ts
git commit -m "feat(web): add tenant registration API"
```

---

### Task 5: Add tenant logout API

**Files:**
- Create: `apps/web/server/api/auth/logout.post.ts`

- [ ] **Step 1: Write `apps/web/server/api/auth/logout.post.ts`**

```ts
import { clearTenantSession, clearTenantCompany } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  clearTenantSession(event)
  clearTenantCompany(event)
  return { ok: true }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/api/auth/logout.post.ts
git commit -m "feat(web): add tenant logout API"
```

---

### Task 6: Add company list and create APIs

**Files:**
- Create: `apps/web/server/api/companies/index.get.ts`
- Create: `apps/web/server/api/companies/index.post.ts`
- Modify: `packages/db/src/platform.ts`

- [ ] **Step 1: Write `apps/web/server/api/companies/index.get.ts`**

```ts
import { listCompaniesForProfile } from 'db/platform'
import { requireTenantSession } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = requireTenantSession(event)
  const companies = await listCompaniesForProfile(session.profileId)
  return companies
})
```

- [ ] **Step 2: Write `apps/web/server/api/companies/index.post.ts`**

```ts
import { createCompany, getCompanyBySlug } from 'db/platform'
import { createMember } from 'db/tenant'
import { requireTenantSession } from '#server/utils/auth'
import { dispatchTrigger } from '#server/utils/dispatch'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function generateUniqueSlug(name: string): Promise<string> {
  let slug = slugify(name) || 'company'
  let candidate = slug
  let suffix = 2
  while (await getCompanyBySlug(candidate)) {
    candidate = `${slug}-${suffix++}`
  }
  return candidate
}

export default defineEventHandler(async (event) => {
  const session = requireTenantSession(event)
  const body = await readBody(event)
  const { name } = body || {}

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Company name required' })
  }

  const slug = await generateUniqueSlug(name)
  const company = await createCompany({ name: name.trim(), slug })

  await createMember(company.namespace, {
    email: '',
    profileId: session.profileId,
    role: 'owner',
    status: 'active',
    inviteCode: null
  })

  event.context.company = { id: company.id, slug: company.slug, namespace: company.namespace }
  await dispatchTrigger(event, 'companies', 'create', company)

  return company
})
```

- [ ] **Step 3: Build db package**

```bash
pnpm --filter db build
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/platform.ts "apps/web/server/api/companies/index.get.ts" "apps/web/server/api/companies/index.post.ts"
git commit -m "feat(web): add company list and create APIs with owner member"
```

---

### Task 7: Add global web auth middleware

**Files:**
- Create: `apps/web/app/middleware/auth.global.ts`
- Delete: `apps/web/app/middleware/company.global.ts`

- [ ] **Step 1: Write `apps/web/app/middleware/auth.global.ts`**

```ts
export default defineNuxtRouteMiddleware((to) => {
  const publicPaths = ['/login', '/register', '/accept-invite', '/logout']
  if (publicPaths.includes(to.path) || to.path.startsWith('/api/')) {
    return
  }

  const session = useCookie('tenant_session')
  if (!session.value) {
    return navigateTo('/login')
  }

  const company = useCookie('company')
  if (!company.value) {
    return navigateTo('/companies')
  }
})
```

- [ ] **Step 2: Delete `apps/web/app/middleware/company.global.ts`**

```bash
rm apps/web/app/middleware/company.global.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/middleware/auth.global.ts
git rm apps/web/app/middleware/company.global.ts
git commit -m "feat(web): add global auth middleware and remove old company middleware"
```

---

### Task 8: Update server member middleware and add API guards

**Files:**
- Modify: `apps/web/server/middleware/member.ts`
- Modify: `apps/web/server/utils/auth.ts`

- [ ] **Step 1: Update `apps/web/server/middleware/member.ts`**

```ts
import { getMemberByProfileId } from 'db/tenant'
import { getTenantSession, getTenantCompany } from '#server/utils/auth'

declare module 'h3' {
  interface H3EventContext {
    account?: { id: string }
    profile?: { id: string }
    company?: { id: string; slug: string; namespace: string }
    member?: { id: string; role: 'owner' | 'admin' | 'member' }
  }
}

export default defineEventHandler(async (event) => {
  const session = getTenantSession(event)
  if (!session) return

  event.context.account = { id: session.accountId }
  event.context.profile = { id: session.profileId }

  const company = getTenantCompany(event)
  if (!company) return

  event.context.company = company

  const member = await getMemberByProfileId(company.namespace, session.profileId)
  if (member && member.status === 'active') {
    event.context.member = { id: member.id, role: member.role }
  }
})
```

- [ ] **Step 2: Add guard helpers to `apps/web/server/utils/auth.ts`**

Append to the file:

```ts
export function requireTenantMember(event: H3Event) {
  requireTenantSession(event)
  const member = event.context.member
  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return member
}

export function requireTenantRole(event: H3Event, roles: Array<'owner' | 'admin' | 'member'>) {
  const member = requireTenantMember(event)
  if (!roles.includes(member.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return member
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/middleware/member.ts apps/web/server/utils/auth.ts
git commit -m "feat(web): resolve member from signed session and company cookie; add guards"
```

---

### Task 9: Apply guards to existing tenant API routes

**Files:**
- Modify: `apps/web/server/api/users/index.get.ts`
- Modify: `apps/web/server/api/users/index.post.ts`
- Modify: `apps/web/server/api/users/accept-invite.post.ts`
- Modify: all files in `apps/web/server/api/workflows/` and `apps/web/server/api/triggers/`

- [ ] **Step 1: Add `requireTenantMember` to read-only routes**

For `apps/web/server/api/users/index.get.ts` and `apps/web/server/api/workflows/index.get.ts`, `apps/web/server/api/workflows/[id].get.ts`, and similar, add at the top:

```ts
import { requireTenantMember } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantMember(event)
  // existing logic
})
```

- [ ] **Step 2: Add `requireTenantRole(['owner','admin'])` to mutation routes**

For workflow/trigger create/update/delete routes and user invite route, add:

```ts
import { requireTenantRole } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  requireTenantRole(event, ['owner', 'admin'])
  // existing logic
})
```

- [ ] **Step 3: Update invite endpoint to return invite URL**

In `apps/web/server/api/users/index.post.ts`, replace the return line with:

```ts
const company = event.context.company
if (!company) {
  throw createError({ statusCode: 500, statusMessage: 'Company context missing' })
}
const inviteUrl = `${getRequestProtocol(event)}://${getRequestHost(event)}/accept-invite?code=${encodeURIComponent(inviteCode)}&company=${encodeURIComponent(company.slug)}`
return { ...safeMember, inviteUrl }
```

- [ ] **Step 4: Update accept-invite endpoint to resolve company by slug**

Replace `apps/web/server/api/users/accept-invite.post.ts` with:

```ts
import { getMemberByInviteCode, updateMember } from 'db/tenant'
import { getAccountByProviderKey, createAccount, createUserProfile, getCompanyBySlug } from 'db/platform'
import { hashPassword, comparePassword } from 'shared'
import { setTenantSession, setTenantCompany } from '#server/utils/auth'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

const inviteAttempts = new Map<string, number[]>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const attempts = inviteAttempts.get(key) ?? []
  const recent = attempts.filter(t => now - t < WINDOW_MS)
  if (recent.length === 0) {
    inviteAttempts.delete(key)
  } else {
    inviteAttempts.set(key, recent)
  }
  return recent.length >= MAX_ATTEMPTS
}

function recordAttempt(key: string) {
  const attempts = inviteAttempts.get(key) ?? []
  attempts.push(Date.now())
  inviteAttempts.set(key, attempts)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { inviteCode, companySlug, email, password, name } = body || {}

  if (!inviteCode || !companySlug || !email || !password || !name) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fields' })
  }

  if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid field types' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const trimmedName = name.trim()

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  }

  if (trimmedName.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Name required' })
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }

  if (isRateLimited(inviteCode)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts' })
  }

  const company = await getCompanyBySlug(companySlug)
  if (!company) {
    throw createError({ statusCode: 400, statusMessage: 'Company not found' })
  }

  const member = await getMemberByInviteCode(company.namespace, inviteCode)
  if (!member || member.status !== 'pending' || member.email !== normalizedEmail) {
    recordAttempt(inviteCode)
    throw createError({ statusCode: 400, statusMessage: 'Invalid invite' })
  }

  let account = await getAccountByProviderKey('email', normalizedEmail)
  let profileId: string

  if (account) {
    if (!account.credential || !(await comparePassword(password, account.credential))) {
      recordAttempt(inviteCode)
      throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
    }
    profileId = account.profileId
  } else {
    const profile = await createUserProfile({ name: trimmedName })
    profileId = profile.id
    account = await createAccount({
      provider: 'email',
      providerKey: normalizedEmail,
      credential: await hashPassword(password),
      profileId
    })
  }

  const updated = await updateMember(company.namespace, member.id, {
    profileId,
    status: 'active',
    inviteCode: null,
    joinedAt: new Date().toISOString()
  })

  setTenantSession(event, { accountId: account.id, profileId })
  setTenantCompany(event, { id: company.id, slug: company.slug, namespace: company.namespace })

  return { ok: true, member: updated }
})
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/api/
git commit -m "feat(web): add tenant auth guards to API routes and expose invite URL"
```

---

### Task 10: Sign admin session cookies

**Files:**
- Modify: `apps/admin/server/utils/session.ts`
- Modify: `apps/admin/server/api/auth/login.post.ts`
- Modify: `apps/admin/app/middleware/auth.global.ts`

- [ ] **Step 1: Update `apps/admin/server/utils/session.ts`**

```ts
import type { H3Event } from 'h3'

export interface AdminSession {
  userId: string
  email: string
}

const SESSION_COOKIE = 'admin_session'

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET is required')
  }
  return secret
}

export function setAdminSession(event: H3Event, session: AdminSession) {
  const { signObject } = await import('shared')
  setCookie(event, SESSION_COOKIE, signObject(session, getSessionSecret()), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24
  })
}

export function getAdminSession(event: H3Event): AdminSession | null {
  const cookie = getCookie(event, SESSION_COOKIE)
  if (!cookie) return null
  const { unsignObject } = await import('shared')
  return unsignObject(cookie, getSessionSecret())
}

export function requireAdminSession(event: H3Event): AdminSession {
  const session = getAdminSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}

export function clearAdminSession(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
```

- [ ] **Step 2: Update `apps/admin/server/api/auth/login.post.ts`**

No changes needed beyond `setAdminSession` now signing the cookie.

- [ ] **Step 3: Update `apps/admin/app/middleware/auth.global.ts`**

```ts
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login' || to.path.startsWith('/api/')) {
    return
  }

  const session = useCookie('admin_session')
  if (!session.value) {
    return navigateTo('/login')
  }
})
```

- [ ] **Step 4: Typecheck admin app**

```bash
pnpm --filter admin typecheck
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/server/utils/session.ts apps/admin/app/middleware/auth.global.ts
git commit -m "feat(admin): sign admin session cookies"
```

---

### Task 11: Add web auth pages

**Files:**
- Create: `apps/web/app/pages/register.vue`
- Create: `apps/web/app/pages/login.vue`
- Create: `apps/web/app/pages/companies/index.vue`
- Create: `apps/web/app/pages/companies/new.vue`
- Create: `apps/web/app/pages/accept-invite.vue`
- Modify: `apps/web/app/layouts/default.vue`

- [ ] **Step 1: Write `apps/web/app/pages/login.vue`**

```vue
<script setup lang="ts">
const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()

async function submit() {
  error.value = ''
  try {
    const result = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    if (result.companies.length === 0) {
      await router.push('/companies')
    } else {
      const company = result.companies[0]
      const companyCookie = useCookie('company')
      companyCookie.value = JSON.stringify({ id: company.id, slug: company.slug, namespace: company.namespace })
      await router.push('/')
    }
  } catch (e: any) {
    error.value = e.statusMessage || 'Login failed'
  }
}
</script>

<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
    <h1 class="text-xl font-semibold mb-4">Log in</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium">Email</label>
        <input v-model="email" type="email" class="border rounded px-3 py-2 w-full" required />
      </div>
      <div>
        <label class="block text-sm font-medium">Password</label>
        <input v-model="password" type="password" class="border rounded px-3 py-2 w-full" required />
      </div>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full">
        Log in
      </button>
      <p class="text-sm text-center">
        No account? <NuxtLink to="/register" class="text-blue-600 hover:underline">Register</NuxtLink>
      </p>
    </form>
  </div>
</template>
```

- [ ] **Step 2: Write `apps/web/app/pages/register.vue`**

```vue
<script setup lang="ts">
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()

async function submit() {
  error.value = ''
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { name: name.value, email: email.value, password: password.value }
    })
    await router.push('/companies')
  } catch (e: any) {
    error.value = e.statusMessage || 'Registration failed'
  }
}
</script>

<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
    <h1 class="text-xl font-semibold mb-4">Register</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium">Name</label>
        <input v-model="name" class="border rounded px-3 py-2 w-full" required />
      </div>
      <div>
        <label class="block text-sm font-medium">Email</label>
        <input v-model="email" type="email" class="border rounded px-3 py-2 w-full" required />
      </div>
      <div>
        <label class="block text-sm font-medium">Password</label>
        <input v-model="password" type="password" class="border rounded px-3 py-2 w-full" required />
      </div>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full">
        Register
      </button>
      <p class="text-sm text-center">
        Already have an account? <NuxtLink to="/login" class="text-blue-600 hover:underline">Log in</NuxtLink>
      </p>
    </form>
  </div>
</template>
```

- [ ] **Step 3: Write `apps/web/app/pages/companies/index.vue`**

```vue
<script setup lang="ts">
interface Company {
  id: string
  name: string
  slug: string
  namespace: string
}

const { data: companies, refresh } = await useFetch<Company[]>('/api/companies')
const router = useRouter()

function enterCompany(company: Company) {
  const companyCookie = useCookie('company')
  companyCookie.value = JSON.stringify({ id: company.id, slug: company.slug, namespace: company.namespace })
  router.push('/')
}
</script>

<template>
  <div class="max-w-xl mx-auto">
    <h1 class="text-2xl font-semibold mb-4">Your companies</h1>
    <div v-if="!companies?.length" class="text-gray-500 mb-4">
      You don't have any companies yet.
    </div>
    <div v-else class="space-y-2 mb-6">
      <button
        v-for="company in companies"
        :key="company.id"
        class="w-full text-left bg-white p-4 rounded shadow hover:bg-gray-50"
        @click="enterCompany(company)"
      >
        <div class="font-medium">{{ company.name }}</div>
        <div class="text-sm text-gray-500">{{ company.slug }}</div>
      </button>
    </div>
    <NuxtLink to="/companies/new" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
      Create a company
    </NuxtLink>
  </div>
</template>
```

- [ ] **Step 4: Write `apps/web/app/pages/companies/new.vue`**

```vue
<script setup lang="ts">
const name = ref('')
const error = ref('')
const router = useRouter()

async function submit() {
  error.value = ''
  try {
    const company = await $fetch('/api/companies', {
      method: 'POST',
      body: { name: name.value }
    })
    const companyCookie = useCookie('company')
    companyCookie.value = JSON.stringify({ id: company.id, slug: company.slug, namespace: company.namespace })
    await router.push('/')
  } catch (e: any) {
    error.value = e.statusMessage || 'Failed to create company'
  }
}
</script>

<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
    <h1 class="text-xl font-semibold mb-4">Create company</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium">Company name</label>
        <input v-model="name" class="border rounded px-3 py-2 w-full" required />
      </div>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full">
        Create
      </button>
    </form>
  </div>
</template>
```

- [ ] **Step 5: Write `apps/web/app/pages/accept-invite.vue`**

```vue
<script setup lang="ts">
const route = useRoute()
const code = computed(() => String(route.query.code || ''))
const companySlug = computed(() => String(route.query.company || ''))

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()

async function submit() {
  error.value = ''
  try {
    await $fetch('/api/users/accept-invite', {
      method: 'POST',
      body: {
        inviteCode: code.value,
        companySlug: companySlug.value,
        email: email.value,
        password: password.value,
        name: name.value
      }
    })
    await router.push('/')
  } catch (e: any) {
    error.value = e.statusMessage || 'Failed to accept invite'
  }
}
</script>

<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
    <h1 class="text-xl font-semibold mb-4">Accept invite</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium">Name</label>
        <input v-model="name" class="border rounded px-3 py-2 w-full" required />
      </div>
      <div>
        <label class="block text-sm font-medium">Email</label>
        <input v-model="email" type="email" class="border rounded px-3 py-2 w-full" required />
      </div>
      <div>
        <label class="block text-sm font-medium">Password</label>
        <input v-model="password" type="password" class="border rounded px-3 py-2 w-full" required />
      </div>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full">
        Accept invite
      </button>
    </form>
  </div>
</template>
```

- [ ] **Step 6: Update `apps/web/app/layouts/default.vue`**

Add auth links and a logout button:

```vue
<script setup lang="ts">
const status = usePlatformStatus()
const session = useCookie('tenant_session')

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <div
      v-if="status?.mode === 'degraded'"
      class="bg-yellow-50 border-b border-yellow-200 text-yellow-800 px-4 py-2"
    >
      <div class="max-w-5xl mx-auto text-sm font-medium">
        {{ status.message ?? 'Some features are temporarily unavailable.' }}
      </div>
    </div>
    <nav class="bg-white border-b border-gray-200">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex gap-6">
          <NuxtLink to="/" class="font-semibold hover:text-blue-600">Home</NuxtLink>
          <NuxtLink to="/users" class="hover:text-blue-600">Users</NuxtLink>
          <NuxtLink to="/workflows" class="hover:text-blue-600">Workflows</NuxtLink>
          <NuxtLink to="/triggers" class="hover:text-blue-600">Triggers</NuxtLink>
          <NuxtLink to="/user-tasks" class="hover:text-blue-600">Tasks</NuxtLink>
        </div>
        <div class="flex items-center gap-3">
          <CompanySwitcher />
          <button
            v-if="session"
            class="text-sm text-gray-600 hover:text-red-600"
            @click="logout"
          >
            Logout
          </button>
          <NuxtLink v-else to="/login" class="text-sm text-blue-600 hover:underline">Login</NuxtLink>
        </div>
      </div>
    </nav>
    <main class="max-w-5xl mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
```

- [ ] **Step 7: Typecheck web app**

```bash
pnpm --filter web typecheck
```

Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/pages apps/web/app/layouts/default.vue
git commit -m "feat(web): add register, login, company selector, and accept-invite pages"
```

---

### Task 12: Remove admin company pages and routes

**Files:**
- Delete: `apps/admin/app/pages/companies/index.vue`
- Delete: `apps/admin/app/pages/companies/new.vue`
- Delete: `apps/admin/server/api/companies/index.get.ts`
- Delete: `apps/admin/server/api/companies/index.post.ts`
- Modify: `apps/admin/app/layouts/default.vue`

- [ ] **Step 1: Delete admin company files**

```bash
rm apps/admin/app/pages/companies/index.vue
rm apps/admin/app/pages/companies/new.vue
rm apps/admin/server/api/companies/index.get.ts
rm apps/admin/server/api/companies/index.post.ts
```

- [ ] **Step 2: Remove company link from `apps/admin/app/layouts/default.vue`**

Remove the `<NuxtLink to="/companies">` line.

- [ ] **Step 3: Typecheck admin app**

```bash
pnpm --filter admin typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git rm apps/admin/app/pages/companies/index.vue apps/admin/app/pages/companies/new.vue apps/admin/server/api/companies/index.get.ts apps/admin/server/api/companies/index.post.ts
git add apps/admin/app/layouts/default.vue
git commit -m "refactor(admin): remove company creation pages; companies are created in web app"
```

---

### Task 13: Update `CompanySwitcher` and web navigation

**Files:**
- Modify: `apps/web/app/components/CompanySwitcher.vue`

- [ ] **Step 1: Update `apps/web/app/components/CompanySwitcher.vue`**

```vue
<script setup lang="ts">
interface Company {
  id: string
  name: string
  slug: string
  namespace: string
}

const { data: companies } = await useFetch<Company[]>('/api/companies')
const companyCookie = useCookie('company')

function onChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const selected = companies.value?.find(c => c.slug === target.value)
  if (selected) {
    companyCookie.value = JSON.stringify({ id: selected.id, slug: selected.slug, namespace: selected.namespace })
  } else {
    companyCookie.value = null
  }
  window.location.reload()
}
</script>

<template>
  <select
    :value="companyCookie ? JSON.parse(companyCookie).slug : ''"
    @change="onChange"
    class="border rounded px-3 py-2 text-sm bg-white"
  >
    <option value="">Select company</option>
    <option v-for="company in companies" :key="company.id" :value="company.slug">
      {{ company.name }}
    </option>
  </select>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/components/CompanySwitcher.vue
git commit -m "feat(web): CompanySwitcher uses tenant company list API"
```

---

### Task 14: Add tests for session helpers

**Files:**
- Modify: `package.json` (root)
- Create: `packages/shared/src/session.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest @vitest/ui
```

- [ ] **Step 2: Add test script to root `package.json`**

```json
"scripts": {
  "test": "vitest",
  "test:ui": "vitest --ui"
}
```

- [ ] **Step 3: Create `vitest.config.ts` at repo root**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  }
})
```

- [ ] **Step 4: Write `packages/shared/src/session.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { signObject, unsignObject } from './session.js'

const SECRET = 'test-secret'

describe('session signing', () => {
  it('round-trips a signed object', () => {
    const obj = { accountId: 'a1', profileId: 'p1' }
    const signed = signObject(obj, SECRET)
    expect(unsignObject(signed, SECRET)).toEqual(obj)
  })

  it('rejects a tampered payload', () => {
    const obj = { accountId: 'a1', profileId: 'p1' }
    const signed = signObject(obj, SECRET)
    const tampered = signed.replace('a1', 'a2')
    expect(unsignObject(tampered, SECRET)).toBeNull()
  })

  it('rejects a signature with the wrong secret', () => {
    const obj = { accountId: 'a1', profileId: 'p1' }
    const signed = signObject(obj, SECRET)
    expect(unsignObject(signed, 'wrong-secret')).toBeNull()
  })
})
```

- [ ] **Step 5: Run tests**

```bash
pnpm test packages/shared/src/session.test.ts
```

Expected: 3 passing tests.

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.ts packages/shared/src/session.test.ts
git commit -m "test(shared): add vitest and session signing tests"
```

---

### Task 15: Final verification

- [ ] **Step 1: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 2: Build shared and db packages**

```bash
pnpm --filter shared build && pnpm --filter db build
```

Expected: both pass.

- [ ] **Step 3: Typecheck all apps**

```bash
pnpm --filter web typecheck
pnpm --filter admin typecheck
pnpm --filter workflow-runtime typecheck
```

Expected: all pass.

- [ ] **Step 4: Full build**

```bash
pnpm -r build
```

Expected: all packages and apps build successfully.

- [ ] **Step 5: Smoke test**

1. Start infrastructure: `docker compose up -d`
2. Seed: `pnpm --filter db seed && pnpm --filter db seed:workflows`
3. Run web app: `pnpm --filter web dev`
4. Visit `http://localhost:3000/register`, create an account.
5. You should be redirected to `/companies`.
6. Create a company, then you should enter the tenant app.
7. Visit `/users`, invite a second email, copy the invite URL.
8. In an incognito window, visit the invite URL, register, and accept the invite.
9. The new user should be able to log in and see the company.

- [ ] **Step 6: Commit any final doc updates**

Update `docs/50-Features/Tenant Authentication & Authorization.md`, `docs/50-Features/Company Management.md`, and `docs/50-Features/User Management.md` to reflect the new flows.

```bash
git add docs/
git commit -m "docs: update tenant auth and company management docs"
```

---

## Self-review

- **Spec coverage:**
  - Public registration → Task 4.
  - Login returning company list → Task 3.
  - Company selector/create → Tasks 6, 11, 13.
  - Signed cookies → Tasks 1, 2, 10.
  - Global web auth middleware → Task 7.
  - API guards → Tasks 8, 9.
  - Accept invite → Tasks 5, 11.
  - Remove admin company pages → Task 12.
  - Tests → Task 14.

- **Placeholder scan:** All steps include file paths and code/commands; no TBDs.

- **Type consistency:** `TenantSession` now only has `accountId`/`profileId`; `TenantCompanyCookie` has `id`/`slug`/`namespace`; guards use these shapes consistently.
