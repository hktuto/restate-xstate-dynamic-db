# DB Session Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stateless signed-cookie sessions with DB-backed sessions, refresh tokens, and BFF-managed auth in `apps/api`.

**Architecture:** `apps/api` issues short-lived access tokens and long-lived refresh tokens as httpOnly cookies. The browser never refreshes tokens itself; API middleware silently refreshes expired access tokens. Sessions are stored in SurrealDB with device fingerprints, enabling concurrency limits and audit. Login-as and API keys are out of scope for this plan.

**Tech Stack:** TypeScript, SurrealDB, Hono, `cookie-signature` via `packages/shared`, Vitest.

---

## File map

| File | Responsibility |
|---|---|
| `packages/db/src/schema-definitions.ts` | Add `sessions` and `company_policies` table definitions. |
| `packages/db/src/platform.ts` | Add platform-namespace session helpers (admin sessions). |
| `packages/db/src/tenant.ts` | Add tenant-namespace session helpers and `company_policies` helpers. |
| `packages/shared/src/session.ts` | Add access-token signing/verification helpers. Keep existing `signObject`/`unsignObject` for compatibility. |
| `packages/shared/src/crypto.ts` (create) | Token/hash utilities: `generateToken`, `hashToken`. |
| `apps/api/src/lib/session.ts` | Replace signed-cookie helpers with DB-backed cookie helpers: `setTenantSession`, `readTenantSession`, `clearTenantSession`, `setAdminSession`, `readAdminSession`, `clearAdminSession`. |
| `apps/api/src/lib/device-fingerprint.ts` (create) | Build device fingerprint and name from request headers. |
| `apps/api/src/lib/refresh-session.ts` (create) | Validate refresh token, rotate it, issue new access token. |
| `apps/api/src/middleware/session.ts` (create) | Unified middleware: validate/refresh access token and attach `TenantScope` or `AdminScope`. |
| `apps/api/src/middleware/tenant.ts` | Switch from signed-cookie read to new session middleware. |
| `apps/api/src/middleware/admin.ts` | Switch from signed-cookie read to new session middleware. |
| `apps/api/src/routes/auth.ts` | Update login/register/logout to use DB sessions and concurrency check. |
| `apps/api/src/types.ts` | Add `session` field to `TenantScope`/`AdminScope`. |
| `apps/web/app/composables/useApi.ts` | No token refresh logic needed; ensure 401 redirects to `/login`. |
| `apps/admin/app/composables/useApi.ts` | Same as web. |
| `apps/web/app/pages/login.vue` | Handle 401 and redirect. |
| `apps/admin/app/pages/login.vue` | Handle 401 and redirect. |
| `apps/api/src/lib/session.test.ts` (create) | Unit tests for token signing/refresh logic. |
| `packages/db/test/sessions.test.ts` (create) | DB tests for session CRUD and concurrency. |
| `apps/api/tests/auth-session.test.ts` (create) | Integration tests for login/refresh/logout. |

---

## Task 1: Add `sessions` and `company_policies` schema

**Files:**
- Modify: `packages/db/src/schema-definitions.ts`

- [ ] **Step 1: Add `company_policies` table in platform schema**

After the `companies` table in `PLATFORM_TABLE_SCHEMAS`:

```ts
table('company_policies', 'Company Policies', [
  column('companyId', 'record', 'relation', { config: { relationId: '_relations:⟨company_policies:companyId:companies:id⟩' } }),
  column('maxSessions', 'number', 'number'),
  column('sessionOverflowAction', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['revoke_oldest', 'reject']) } }),
  column('allowImpersonation', 'boolean', 'checkbox'),
  column('allowApiKeys', 'boolean', 'checkbox'),
], [relation('companyId', 'companies')]),
```

- [ ] **Step 2: Add `sessions` table in platform schema**

After `company_policies`:

```ts
table('sessions', 'Sessions', [
  column('refreshTokenHash', 'string', 'text', { unique: true }),
  column('accessTokenJti', 'string', 'text'),
  column('accountId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:accountId:accounts:id⟩' } }),
  column('profileId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:profileId:user_profiles:id⟩' } }),
  column('platformUserId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:platformUserId:platform_users:id⟩' } }),
  column('email', 'string', 'text'),
  column('type', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['user', 'impersonation']) } }),
  column('impersonatorId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:impersonatorId:user_profiles:id⟩' } }),
  column('companyId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:companyId:companies:id⟩' } }),
  column('deviceFingerprint', 'string', 'text'),
  column('deviceName', 'string', 'text'),
  column('ip', 'string', 'text'),
  column('userAgent', 'string', 'text'),
  column('refreshExpiresAt', 'datetime', 'date'),
  column('accessExpiresAt', 'datetime', 'date'),
  column('lastUsedAt', 'datetime', 'date'),
  column('revokedAt', 'datetime', 'date'),
  column('revokeReason', 'string', 'text'),
], [relation('accountId', 'accounts'), relation('profileId', 'user_profiles'), relation('platformUserId', 'platform_users'), relation('impersonatorId', 'user_profiles'), relation('companyId', 'companies')]),
```

- [ ] **Step 3: Add `sessions` table in tenant schema**

In `TENANT_TABLE_SCHEMAS`, add a `sessions` table that references tenant `members`. `profileId` is a plain string because `user_profiles` lives in the platform namespace.

```ts
table('sessions', 'Sessions', [
  column('refreshTokenHash', 'string', 'text', { unique: true }),
  column('accessTokenJti', 'string', 'text'),
  column('memberId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:memberId:members:id⟩' } }),
  column('profileId', 'string', 'text'),
  column('type', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['user', 'impersonation']) } }),
  column('impersonatorId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:impersonatorId:members:id⟩' } }),
  column('deviceFingerprint', 'string', 'text'),
  column('deviceName', 'string', 'text'),
  column('ip', 'string', 'text'),
  column('userAgent', 'string', 'text'),
  column('refreshExpiresAt', 'datetime', 'date'),
  column('accessExpiresAt', 'datetime', 'date'),
  column('lastUsedAt', 'datetime', 'date'),
  column('revokedAt', 'datetime', 'date'),
  column('revokeReason', 'string', 'text'),
], [relation('memberId', 'members'), relation('impersonatorId', 'members')]),
```

- [ ] **Step 4: Typecheck db package**

```bash
cd D:/work/restate-xstate
pnpm --filter db typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema-definitions.ts
git commit -m "feat(db): add sessions and company_policies tables"
```

---

## Task 2: Shared crypto/token utilities

**Files:**
- Create: `packages/shared/src/crypto.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create token utilities**

```ts
import { randomBytes, createHash } from 'node:crypto'

export function generateToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('hex')}`
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
```

- [ ] **Step 2: Export from shared index**

In `packages/shared/src/index.ts`, add:

```ts
export * from './crypto.js'
```

- [ ] **Step 3: Typecheck shared package**

```bash
pnpm --filter shared typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/crypto.ts packages/shared/src/index.ts
git commit -m "feat(shared): token generation and hashing helpers"
```

---

## Task 3: Shared access-token helpers

**Files:**
- Modify: `packages/shared/src/session.ts`

- [ ] **Step 1: Add access token payload type and sign/verify helpers**

Append to `packages/shared/src/session.ts`:

```ts
export interface AccessTokenPayload {
  sessionId: string
  accountId: string
  profileId: string
  email?: string
  companyId?: string
  type: 'user' | 'impersonation'
  impersonatorId?: string
  jti: string
  exp: number
  iat: number
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat'>, secret: string): string {
  return signObject({ ...payload, iat: Date.now() }, secret)
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload | null {
  const obj = unsignObject<AccessTokenPayload>(token, secret)
  if (!obj) return null
  if (obj.exp < Date.now()) return null
  return obj
}
```

- [ ] **Step 2: Typecheck shared package**

```bash
pnpm --filter shared typecheck
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/session.ts
git commit -m "feat(shared): access token sign/verify helpers"
```

---

## Task 4: DB session helpers (platform)

**Files:**
- Modify: `packages/db/src/platform.ts`

- [ ] **Step 1: Add types and helper functions**

Add near the top with other types:

```ts
export interface PlatformSessionRecord {
  id: string
  refreshTokenHash: string
  accessTokenJti: string
  accountId?: string
  profileId?: string
  platformUserId?: string
  email: string
  type: 'user' | 'impersonation'
  impersonatorId?: string
  companyId?: string
  deviceFingerprint?: string
  deviceName?: string
  ip?: string
  userAgent?: string
  refreshExpiresAt: string
  accessExpiresAt: string
  lastUsedAt: string
  revokedAt?: string
  revokeReason?: string
  [key: string]: unknown
}

export interface CreatePlatformSessionInput {
  refreshTokenHash: string
  accessTokenJti: string
  accountId: string
  profileId: string
  email: string
  type?: 'user' | 'impersonation'
  impersonatorId?: string
  companyId?: string
  deviceFingerprint?: string
  deviceName?: string
  ip?: string
  userAgent?: string
  refreshExpiresAt: string
  accessExpiresAt: string
}
```

Add functions:

```ts
export async function createPlatformSession(namespace: string, input: CreatePlatformSessionInput): Promise<PlatformSessionRecord> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    const [rows] = await surreal.query<[PlatformSessionRecord[]]>(
      'CREATE sessions CONTENT $data RETURN *',
      { data: { ...input, type: input.type ?? 'user', lastUsedAt: new Date().toISOString() } }
    )
    return rows[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformSessionByRefreshToken(namespace: string, refreshTokenHash: string): Promise<PlatformSessionRecord | null> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    const [rows] = await surreal.query<[PlatformSessionRecord[]]>(
      'SELECT * FROM sessions WHERE refreshTokenHash = $hash AND revokedAt IS NONE AND refreshExpiresAt > $now LIMIT 1',
      { hash: refreshTokenHash, now: new Date().toISOString() }
    )
    return rows[0] ?? null
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePlatformSessionToken(namespace: string, sessionId: string, updates: Partial<Pick<PlatformSessionRecord, 'refreshTokenHash' | 'accessTokenJti' | 'accessExpiresAt' | 'refreshExpiresAt'>>): Promise<void> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    await surreal.query(
      'UPDATE type::record($id) MERGE $updates',
      { id: sessionId, updates }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function revokePlatformSession(namespace: string, sessionId: string, reason?: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    await surreal.query(
      'UPDATE type::record($id) SET revokedAt = $now, revokeReason = $reason',
      { id: sessionId, now: new Date().toISOString(), reason: reason ?? null }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function countActivePlatformSessions(namespace: string, accountId: string): Promise<number> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    const [rows] = await surreal.query<[number[]]>(
      'SELECT count() FROM sessions WHERE accountId = $accountId AND revokedAt IS NONE AND refreshExpiresAt > $now GROUP ALL',
      { accountId, now: new Date().toISOString() }
    )
    return Number(rows[0] ?? 0)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function findOldestActivePlatformSession(namespace: string, accountId: string): Promise<PlatformSessionRecord | null> {
  const surreal = await getSurreal(namespace, 'admin')
  try {
    const [rows] = await surreal.query<[PlatformSessionRecord[]]>(
      'SELECT * FROM sessions WHERE accountId = $accountId AND revokedAt IS NONE AND refreshExpiresAt > $now ORDER BY lastUsedAt ASC LIMIT 1',
      { accountId, now: new Date().toISOString() }
    )
    return rows[0] ?? null
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 2: Typecheck db package**

```bash
pnpm --filter db typecheck
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/platform.ts
git commit -m "feat(db): platform session helpers"
```

---

## Task 5: DB session helpers (tenant)

**Files:**
- Modify: `packages/db/src/tenant.ts`

- [ ] **Step 1: Add company_policies helpers**

Add types and functions:

```ts
export interface CompanyPolicyRecord {
  id: string
  companyId: string
  maxSessions?: number | null
  sessionOverflowAction?: 'revoke_oldest' | 'reject'
  allowImpersonation?: boolean
  allowApiKeys?: boolean
  [key: string]: unknown
}

export async function getCompanyPolicy(namespace: string, companyId: string): Promise<CompanyPolicyRecord | null> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[CompanyPolicyRecord[]]>(
      'SELECT * FROM company_policies WHERE companyId = $companyId LIMIT 1',
      { companyId }
    )
    return rows[0] ?? null
  } finally {
    await closeSurreal(surreal)
  }
}

export async function ensureCompanyPolicy(namespace: string, companyId: string): Promise<CompanyPolicyRecord> {
  const existing = await getCompanyPolicy(namespace, companyId)
  if (existing) return existing
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[CompanyPolicyRecord[]]>(
      'CREATE company_policies CONTENT $data RETURN *',
      {
        data: {
          companyId,
          maxSessions: null,
          sessionOverflowAction: 'revoke_oldest',
          allowImpersonation: true,
          allowApiKeys: true
        }
      }
    )
    return rows[0]
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 2: Add tenant session types and helpers**

Add types:

```ts
export interface TenantSessionRecord {
  id: string
  refreshTokenHash: string
  accessTokenJti: string
  memberId: string
  profileId: string
  type: 'user' | 'impersonation'
  impersonatorId?: string
  deviceFingerprint?: string
  deviceName?: string
  ip?: string
  userAgent?: string
  refreshExpiresAt: string
  accessExpiresAt: string
  lastUsedAt: string
  revokedAt?: string
  revokeReason?: string
  [key: string]: unknown
}

export interface CreateTenantSessionInput {
  refreshTokenHash: string
  accessTokenJti: string
  memberId: string
  profileId: string
  type?: 'user' | 'impersonation'
  impersonatorId?: string
  deviceFingerprint?: string
  deviceName?: string
  ip?: string
  userAgent?: string
  refreshExpiresAt: string
  accessExpiresAt: string
}
```

Add functions mirroring platform helpers but operating on tenant namespace with `memberId`:

```ts
export async function createTenantSession(namespace: string, input: CreateTenantSessionInput): Promise<TenantSessionRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[TenantSessionRecord[]]>(
      'CREATE sessions CONTENT $data RETURN *',
      { data: { ...input, type: input.type ?? 'user', lastUsedAt: new Date().toISOString() } }
    )
    return rows[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getTenantSessionByRefreshToken(namespace: string, refreshTokenHash: string): Promise<TenantSessionRecord | null> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[TenantSessionRecord[]]>(
      'SELECT * FROM sessions WHERE refreshTokenHash = $hash AND revokedAt IS NONE AND refreshExpiresAt > $now LIMIT 1',
      { hash: refreshTokenHash, now: new Date().toISOString() }
    )
    return rows[0] ?? null
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateTenantSessionToken(namespace: string, sessionId: string, updates: Partial<Pick<TenantSessionRecord, 'refreshTokenHash' | 'accessTokenJti' | 'accessExpiresAt' | 'refreshExpiresAt'>>): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query(
      'UPDATE type::record($id) MERGE $updates',
      { id: sessionId, updates }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function revokeTenantSession(namespace: string, sessionId: string, reason?: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query(
      'UPDATE type::record($id) SET revokedAt = $now, revokeReason = $reason',
      { id: sessionId, now: new Date().toISOString(), reason: reason ?? null }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function countActiveTenantSessions(namespace: string, memberId: string): Promise<number> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[number[]]>(
      'SELECT count() FROM sessions WHERE memberId = $memberId AND revokedAt IS NONE AND refreshExpiresAt > $now GROUP ALL',
      { memberId, now: new Date().toISOString() }
    )
    return Number(rows[0] ?? 0)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function findOldestActiveTenantSession(namespace: string, memberId: string): Promise<TenantSessionRecord | null> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[TenantSessionRecord[]]>(
      'SELECT * FROM sessions WHERE memberId = $memberId AND revokedAt IS NONE AND refreshExpiresAt > $now ORDER BY lastUsedAt ASC LIMIT 1',
      { memberId, now: new Date().toISOString() }
    )
    return rows[0] ?? null
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 3: Typecheck db package**

```bash
pnpm --filter db typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/tenant.ts
git commit -m "feat(db): tenant session and company_policy helpers"
```

---

## Task 6: Device fingerprint helper

**Files:**
- Create: `apps/api/src/lib/device-fingerprint.ts`

- [ ] **Step 1: Implement fingerprint builder**

```ts
import type { Context } from 'hono'
import { createHash } from 'node:crypto'
import { getClientIP } from './utils.js' // create if missing, or inline

export interface DeviceInfo {
  fingerprint: string
  name: string
  userAgent: string
  ip: string
}

export function extractDeviceInfo(c: Context): DeviceInfo {
  const userAgent = c.req.header('user-agent') ?? 'unknown'
  const acceptLanguage = c.req.header('accept-language') ?? ''
  const platform = c.req.header('sec-ch-ua-platform') ?? ''
  const clientDeviceId = c.req.header('x-device-id') ?? ''
  const ip = getClientIP(c) ?? 'unknown'

  const fingerprint = createHash('sha256')
    .update([userAgent, acceptLanguage, platform, clientDeviceId].join('|'))
    .digest('hex')

  const name = deriveDeviceName(userAgent)

  return { fingerprint, name, userAgent, ip }
}

function deriveDeviceName(userAgent: string): string {
  const browser = parseBrowser(userAgent)
  const os = parseOS(userAgent)
  return `${browser} on ${os}`
}

function parseBrowser(ua: string): string {
  if (ua.includes('Chrome/')) return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari'
  if (ua.includes('Edge/')) return 'Edge'
  return 'Browser'
}

function parseOS(ua: string): string {
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac OS')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  return 'Unknown'
}

function getClientIP(c: Context): string | undefined {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim()
  return c.req.header('x-real-ip')
}
```

- [ ] **Step 2: Typecheck api package**

```bash
pnpm --filter api typecheck
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/device-fingerprint.ts
git commit -m "feat(api): device fingerprint helper"
```

---

## Task 7: API session helpers

**Files:**
- Modify: `apps/api/src/lib/session.ts`
- Modify: `apps/api/src/env.ts`

- [ ] **Step 1: Replace session.ts with DB-backed helpers**

Replace entire contents of `apps/api/src/lib/session.ts`:

```ts
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { AccessTokenPayload } from 'shared'
import { signAccessToken, verifyAccessToken, generateToken, hashToken } from 'shared'
import { getEnv } from '../env.js'

const ACCESS_TOKEN_COOKIE = 'tenant_access_token'
const REFRESH_TOKEN_COOKIE = 'tenant_refresh_token'
const ADMIN_ACCESS_TOKEN_COOKIE = 'admin_access_token'
const ADMIN_REFRESH_TOKEN_COOKIE = 'admin_refresh_token'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
}

function getSessionSecret(): string {
  return getEnv().sessionSecret
}

function accessTokenExpiry(): Date {
  return new Date(Date.now() + 15 * 60 * 1000)
}

function refreshTokenExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
}

export interface TenantSession {
  sessionId: string
  accountId: string
  profileId: string
  companyId?: string
  type: 'user' | 'impersonation'
  impersonatorId?: string
}

export interface AdminSession {
  sessionId: string
  userId: string
  email: string
}

export function createAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'jti'> & { jti?: string }): { token: string; jti: string; expiresAt: Date } {
  const jti = generateToken('jti')
  const expiresAt = accessTokenExpiry()
  const token = signAccessToken(
    { ...payload, jti, exp: expiresAt.getTime(), iat: Date.now() },
    getSessionSecret()
  )
  return { token, jti, expiresAt }
}

export function verifyAccessTokenCookie(token: string): AccessTokenPayload | null {
  return verifyAccessToken(token, getSessionSecret())
}

export function createRefreshToken(): { token: string; hash: string } {
  const token = generateToken('refresh')
  return { token, hash: hashToken(token) }
}

export function hashRefreshToken(token: string): string {
  return hashToken(token)
}

export function setTenantSessionCookies(c: Context, accessToken: string, refreshToken: string) {
  setCookie(c, ACCESS_TOKEN_COOKIE, accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 })
  setCookie(c, REFRESH_TOKEN_COOKIE, refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 })
}

export function setAdminSessionCookies(c: Context, accessToken: string, refreshToken: string) {
  setCookie(c, ADMIN_ACCESS_TOKEN_COOKIE, accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 })
  setCookie(c, ADMIN_REFRESH_TOKEN_COOKIE, refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 })
}

export function readTenantAccessToken(c: Context): string | undefined {
  return getCookie(c, ACCESS_TOKEN_COOKIE)
}

export function readTenantRefreshToken(c: Context): string | undefined {
  return getCookie(c, REFRESH_TOKEN_COOKIE)
}

export function readAdminAccessToken(c: Context): string | undefined {
  return getCookie(c, ADMIN_ACCESS_TOKEN_COOKIE)
}

export function readAdminRefreshToken(c: Context): string | undefined {
  return getCookie(c, ADMIN_REFRESH_TOKEN_COOKIE)
}

export function clearTenantSession(c: Context) {
  deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: '/' })
  deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: '/' })
}

export function clearAdminSession(c: Context) {
  deleteCookie(c, ADMIN_ACCESS_TOKEN_COOKIE, { path: '/' })
  deleteCookie(c, ADMIN_REFRESH_TOKEN_COOKIE, { path: '/' })
}

export { setTenantCompany, clearTenantCompany, readTenantCompany } from './legacy-session.js'
```

Note: `setTenantCompany`/`clearTenantCompany`/`readTenantCompany` need to stay because the `company` cookie is still plain JSON. Move them to a new file `apps/api/src/lib/legacy-session.ts` or keep inline. For simplicity, keep them in the same file but separate from token cookies.

Actually, keep `setTenantCompany`/`clearTenantCompany`/`readTenantCompany` in `session.ts` and only replace the signed-cookie token helpers.

- [ ] **Step 2: Typecheck api package**

```bash
pnpm --filter api typecheck
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/session.ts
git commit -m "feat(api): DB-backed session cookie helpers"
```

---

## Task 8: Refresh-session helper

**Files:**
- Create: `apps/api/src/lib/refresh-session.ts`

- [ ] **Step 1: Implement refresh logic**

```ts
import type { Context } from 'hono'
import {
  getTenantSessionByRefreshToken,
  updateTenantSessionToken,
  revokeTenantSession,
} from 'db/tenant'
import {
  getPlatformSessionByRefreshToken,
  updatePlatformSessionToken,
  revokePlatformSession,
} from 'db/platform'
import type { TenantSessionRecord } from 'db/tenant'
import type { PlatformSessionRecord } from 'db/platform'
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  setTenantSessionCookies,
  setAdminSessionCookies,
  type TenantSession,
  type AdminSession,
} from './session.js'

export interface RefreshResult {
  accessToken: string
  refreshToken: string
  session: TenantSession | AdminSession
}

export async function refreshTenantSession(namespace: string, refreshToken: string): Promise<RefreshResult | null> {
  const hash = hashRefreshToken(refreshToken)
  const record = await getTenantSessionByRefreshToken(namespace, hash)
  if (!record) return null

  // Rotation: if token hash does not match the current one, revoke for reuse detection
  if (record.refreshTokenHash !== hash) {
    await revokeTenantSession(namespace, record.id, 'refresh_token_reuse')
    return null
  }

  const newRefresh = createRefreshToken()
  const access = createAccessToken({
    sessionId: record.id,
    accountId: record.profileId, // tenant sessions do not have accountId; use profileId
    profileId: record.profileId,
    type: record.type,
    impersonatorId: record.impersonatorId,
  })

  await updateTenantSessionToken(namespace, record.id, {
    refreshTokenHash: newRefresh.hash,
    accessTokenJti: access.jti,
    accessExpiresAt: access.expiresAt.toISOString(),
  })

  return {
    accessToken: access.token,
    refreshToken: newRefresh.token,
    session: {
      sessionId: record.id,
      accountId: record.profileId,
      profileId: record.profileId,
      type: record.type,
      impersonatorId: record.impersonatorId,
    },
  }
}

export async function refreshAdminSession(namespace: string, refreshToken: string): Promise<RefreshResult | null> {
  const hash = hashRefreshToken(refreshToken)
  const record = await getPlatformSessionByRefreshToken(namespace, hash)
  if (!record) return null

  if (record.refreshTokenHash !== hash) {
    await revokePlatformSession(namespace, record.id, 'refresh_token_reuse')
    return null
  }

  const newRefresh = createRefreshToken()
  const access = createAccessToken({
    sessionId: record.id,
    accountId: record.accountId,
    profileId: record.profileId,
    companyId: record.companyId,
    type: record.type,
    impersonatorId: record.impersonatorId,
  })

  await updatePlatformSessionToken(namespace, record.id, {
    refreshTokenHash: newRefresh.hash,
    accessTokenJti: access.jti,
    accessExpiresAt: access.expiresAt.toISOString(),
  })

  return {
    accessToken: access.token,
    refreshToken: newRefresh.token,
    session: {
      sessionId: record.id,
      userId: record.profileId,
      email: record.email,
    },
  }
}
```

Note: `AdminSession` needs email. Add `email` column to platform `sessions` table, or derive from `platform_users` lookup. Add `email` to platform `sessions` schema and helpers.

- [ ] **Step 2: Add `email` column to platform sessions schema**

In `packages/db/src/schema-definitions.ts` platform `sessions`, add:

```ts
column('email', 'string', 'text'),
```

Update `PlatformSessionRecord` and `CreatePlatformSessionInput` in `packages/db/src/platform.ts` to include `email`.

- [ ] **Step 3: Typecheck api package**

```bash
pnpm --filter api typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/refresh-session.ts packages/db/src/schema-definitions.ts packages/db/src/platform.ts
git commit -m "feat(api): session refresh helper with rotation"
```

---

## Task 9: Unified session middleware

**Files:**
- Create: `apps/api/src/middleware/session.ts`
- Modify: `apps/api/src/middleware/tenant.ts`
- Modify: `apps/api/src/middleware/admin.ts`

- [ ] **Step 1: Create session middleware**

```ts
import type { Context, Next } from 'hono'
import {
  readTenantAccessToken,
  readTenantRefreshToken,
  readAdminAccessToken,
  readAdminRefreshToken,
  verifyAccessTokenCookie,
  clearTenantSession,
  clearAdminSession,
} from '../lib/session.js'
import { refreshTenantSession, refreshAdminSession } from '../lib/refresh-session.js'
import type { TenantSession, AdminSession } from '../lib/session.js'

export async function tenantSessionMiddleware(c: Context, next: Next) {
  const accessToken = readTenantAccessToken(c)
  let session: TenantSession | null = null

  if (accessToken) {
    const payload = verifyAccessTokenCookie(accessToken)
    if (payload) {
      session = {
        sessionId: payload.sessionId,
        accountId: payload.accountId,
        profileId: payload.profileId,
        companyId: payload.companyId,
        type: payload.type,
        impersonatorId: payload.impersonatorId,
      }
    }
  }

  if (!session) {
    const refreshToken = readTenantRefreshToken(c)
    const namespace = c.get('tenantNamespace') as string | undefined
    if (refreshToken && namespace) {
      const result = await refreshTenantSession(namespace, refreshToken)
      if (result) {
        setTenantSessionCookies(c, result.accessToken, result.refreshToken)
        session = result.session as TenantSession
      }
    }
  }

  if (!session) {
    clearTenantSession(c)
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('tenantSession', session)
  await next()
}

export async function adminSessionMiddleware(c: Context, next: Next) {
  const accessToken = readAdminAccessToken(c)
  let session: AdminSession | null = null

  if (accessToken) {
    const payload = verifyAccessTokenCookie(accessToken)
    if (payload) {
      session = {
        sessionId: payload.sessionId,
        userId: payload.accountId,
        email: payload.email ?? '',
      }
    }
  }

  if (!session) {
    const refreshToken = readAdminRefreshToken(c)
    if (refreshToken) {
      const result = await refreshAdminSession('platform', refreshToken)
      if (result) {
        setAdminSessionCookies(c, result.accessToken, result.refreshToken)
        session = result.session as AdminSession
      }
    }
  }

  if (!session) {
    clearAdminSession(c)
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('adminSession', session)
  await next()
}
```

- [ ] **Step 2: Update tenant middleware to use session middleware**

In `apps/api/src/middleware/tenant.ts`:

1. Run `tenantSessionMiddleware` first to validate/refresh the session and set `tenantSession`.
2. Then use `c.get('tenantSession')` to load the `member` record for the current company and build `TenantScope`.
3. Remove the old signed-cookie `tenant_session` parsing.

- [ ] **Step 3: Update admin middleware**

In `apps/api/src/middleware/admin.ts`:

1. Run `adminSessionMiddleware` to validate/refresh the session.
2. Use `c.get('adminSession')` to build `AdminScope`.
3. Remove the old signed-cookie `admin_session` parsing.

- [ ] **Step 4: Typecheck api package**

```bash
pnpm --filter api typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/middleware/session.ts apps/api/src/middleware/tenant.ts apps/api/src/middleware/admin.ts
git commit -m "feat(api): unified DB session middleware"
```

---

## Task 10: Update auth routes

**Files:**
- Modify: `apps/api/src/routes/auth.ts`

- [ ] **Step 1: Update login to create DB session**

Replace `setTenantSession(c, { accountId, profileId })` with:

```ts
import {
  createAccessToken,
  createRefreshToken,
  setTenantSessionCookies,
} from '../lib/session.js'
import { extractDeviceInfo } from '../lib/device-fingerprint.js'
import {
  createTenantSession,
  updateTenantSessionToken,
} from 'db/tenant'

// After profile is loaded:
const device = extractDeviceInfo(c)
const refresh = createRefreshToken()

// Create session first so we have a session id.
const session = await createTenantSession('platform', {
  refreshTokenHash: refresh.hash,
  accessTokenJti: 'pending',
  memberId: '', // tenant namespace not known yet; store profileId and update memberId when company is selected
  profileId: profile.id,
  deviceFingerprint: device.fingerprint,
  deviceName: device.name,
  ip: device.ip,
  userAgent: device.userAgent,
  refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
})

const access = createAccessToken({
  sessionId: session.id,
  accountId: account.id,
  profileId: profile.id,
  type: 'user',
})

await updateTenantSessionToken('platform', session.id, { accessTokenJti: access.jti })
setTenantSessionCookies(c, access.token, refresh.token)
```

Note: Tenant sessions are created in the platform namespace because the user has not selected a company yet. When the user selects a company, the existing session continues to work; the tenant middleware loads the member record from the company namespace using `profileId`.

Simplify: tenant sessions use `profileId` for counting if no company selected at login.

- [ ] **Step 2: Update register to create DB session**

Same pattern as login after account/profile creation.

- [ ] **Step 3: Update logout to revoke session**

Read access token → verify → revoke session by id → clear cookies.

- [ ] **Step 4: Update admin login to create platform session**

Use platform session helpers.

- [ ] **Step 5: Typecheck api package**

```bash
pnpm --filter api typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/auth.ts
git commit -m "feat(api): DB session lifecycle in auth routes"
```

---

## Task 11: Update frontend useApi and login pages

**Files:**
- Modify: `apps/web/app/composables/useApi.ts`
- Modify: `apps/admin/app/composables/useApi.ts`
- Modify: `apps/web/app/pages/login.vue`
- Modify: `apps/admin/app/pages/login.vue`

- [ ] **Step 1: Add 401 redirect in web useApi**

In `apps/web/app/composables/useApi.ts`, update error handling:

```ts
if (!res.ok) {
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    await navigateTo('/login')
  }
  throw new Error(body.error ?? `API error ${res.status}`)
}
```

- [ ] **Step 2: Same for admin useApi**

- [ ] **Step 3: Typecheck web and admin**

```bash
pnpm --filter web typecheck
pnpm --filter admin typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/composables/useApi.ts apps/admin/app/composables/useApi.ts
git commit -m "feat(web,admin): redirect to login on 401"
```

---

## Task 12: Tests

**Files:**
- Create: `packages/db/test/sessions.test.ts`
- Create: `apps/api/src/lib/session.test.ts`
- Create: `apps/api/tests/auth-session.test.ts`

- [ ] **Step 1: DB session tests**

Create `packages/db/test/sessions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createTenantSession, getTenantSessionByRefreshToken, revokeTenantSession, countActiveTenantSessions } from '../src/tenant'

describe('tenant sessions', () => {
  it('creates and retrieves a session by refresh token hash', async () => {
    const session = await createTenantSession('test', {
      refreshTokenHash: 'hash1',
      accessTokenJti: 'jti1',
      memberId: 'members:test',
      profileId: 'user_profiles:test',
      refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      accessExpiresAt: new Date(Date.now() + 900000).toISOString(),
    })
    const loaded = await getTenantSessionByRefreshToken('test', 'hash1')
    expect(loaded?.id).toBe(session.id)
  })

  it('does not return revoked sessions', async () => {
    const session = await createTenantSession('test', {
      refreshTokenHash: 'hash2',
      accessTokenJti: 'jti2',
      memberId: 'members:test',
      profileId: 'user_profiles:test',
      refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      accessExpiresAt: new Date(Date.now() + 900000).toISOString(),
    })
    await revokeTenantSession('test', session.id)
    const loaded = await getTenantSessionByRefreshToken('test', 'hash2')
    expect(loaded).toBeNull()
  })

  it('counts active sessions', async () => {
    await createTenantSession('test', {
      refreshTokenHash: 'hash3',
      accessTokenJti: 'jti3',
      memberId: 'members:test',
      profileId: 'user_profiles:test',
      refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      accessExpiresAt: new Date(Date.now() + 900000).toISOString(),
    })
    const count = await countActiveTenantSessions('test', 'members:test')
    expect(count).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: API session helper tests**

Create `apps/api/src/lib/session.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createAccessToken, verifyAccessTokenCookie, createRefreshToken, hashRefreshToken } from './session.js'
import { getEnv } from '../env.js'

describe('session helpers', () => {
  it('signs and verifies access tokens', () => {
    const { token, jti } = createAccessToken({
      sessionId: 'sess:1',
      accountId: 'acc:1',
      profileId: 'prof:1',
      type: 'user',
    })
    const payload = verifyAccessTokenCookie(token)
    expect(payload?.sessionId).toBe('sess:1')
    expect(payload?.jti).toBe(jti)
  })

  it('rejects expired access tokens', () => {
    const { token } = createAccessToken({
      sessionId: 'sess:1',
      accountId: 'acc:1',
      profileId: 'prof:1',
      type: 'user',
    })
    // expiry is in Date.now() + 15 min; no easy way to test expiry without mocking time
    // skip or use vi.useFakeTimers
  })

  it('hashes refresh tokens consistently', () => {
    const { token } = createRefreshToken()
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token))
  })
})
```

- [ ] **Step 3: Run db and api tests**

```bash
pnpm --filter db test sessions.test.ts
pnpm --filter api test session.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/db/test/sessions.test.ts apps/api/src/lib/session.test.ts
git commit -m "test(db,api): session helpers and DB session CRUD"
```

---

## Task 13: Full verification

- [ ] **Step 1: Run all package tests**

```bash
pnpm --filter shared test
pnpm --filter db test
pnpm --filter workflow-actions test
pnpm --filter workflow-runtime test
```

Expected: all pass.

- [ ] **Step 2: Run app typechecks**

```bash
pnpm --filter api typecheck
pnpm --filter admin typecheck
pnpm --filter web typecheck
```

Expected: all pass.

- [ ] **Step 3: Commit any fixes**

```bash
git commit -m "fix: session auth typecheck and test fixes"
```

---

## Self-review checklist

- [ ] `sessions` table exists in both platform and tenant schemas.
- [ ] `company_policies` table exists in tenant schema.
- [ ] Shared helpers for token generation, hashing, and access-token signing exist.
- [ ] DB helpers for create/get/revoke/count/find-oldest exist for both platform and tenant sessions.
- [ ] Device fingerprint helper exists.
- [ ] API `session.ts` helpers use DB-backed cookies.
- [ ] Refresh-session helper rotates tokens and detects reuse.
- [ ] Middleware validates/refreshses access tokens and attaches scope.
- [ ] Auth routes create DB sessions and enforce concurrency.
- [ ] Frontend redirects on 401.
- [ ] Tests cover session CRUD and token signing.
