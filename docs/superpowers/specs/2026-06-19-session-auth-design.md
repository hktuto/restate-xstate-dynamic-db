---
title: DB Session Auth Design
type: spec
status: done
area: auth
app:
  - api
  - web
  - admin
created: 2026-06-19
updated: 2026-06-19
related:
  - [[20-Architecture/Data Model]]
  - [[50-Features/Tenant Authentication & Authorization]]
  - [[40-Packages/db]]
---

# DB Session Auth Design

## Goal

Replace the current stateless signed-cookie session with DB-backed sessions managed by `apps/api` as a Backend-for-Frontend (BFF). This enables:

- Server-side session revocation and audit.
- Per-company concurrency limits and license-aware policies.
- Device fingerprint logging.
- Admin "login as" impersonation with audit trail.
- Service-account API key auth with scoped permissions.

## Context

Today auth uses two signed cookies:

- `tenant_session` — signed object `{ accountId, profileId }`.
- `admin_session` — signed object `{ userId, email }`.

There is no `sessions` table. Session validation is signature-only, so the server cannot revoke a single session or enforce one-session-per-device.

## Decision

Use **Approach B**: one `sessions` table for interactive browser sessions, and a separate `api_keys` table for service-account tokens.

`apps/api` acts as the BFF: the browser holds only BFF session cookies; token refresh happens transparently inside the API middleware.

## Data model

### `sessions`

Stored per namespace (tenant `company_<uuid>/main` for tenant sessions, `platform/admin` for admin sessions).

Platform `sessions` can store either tenant-user sessions (using `accountId` and `profileId`) or admin sessions (using `platformUserId`); only the relevant columns are populated for a given session. Tenant `sessions` are company-scoped and use `memberId` to reference the current company member.

```ts
table('sessions', 'Sessions', [
  column('refreshTokenHash', 'string', 'text', { unique: true }), // SHA-256 of refresh token
  column('accessTokenJti', 'string', 'text'),                     // current access token id
  column('accountId', 'record', 'relation'),                      // accounts.id (tenant users)
  column('profileId', 'record', 'relation'),                      // user_profiles.id (tenant users)
  column('platformUserId', 'record', 'relation'),                 // platform_users.id (admin users)
  column('email', 'string', 'text'),
  column('type', 'string', 'select'),                             // 'user' | 'impersonation'
  column('impersonatorId', 'record', 'relation'),                 // user_profiles.id, nullable
  column('companyId', 'record', 'relation'),                      // companies.id, nullable for platform admin sessions
  column('deviceFingerprint', 'string', 'text'),
  column('deviceName', 'string', 'text'),
  column('ip', 'string', 'text'),
  column('userAgent', 'string', 'text'),
  column('refreshExpiresAt', 'datetime', 'date'),
  column('accessExpiresAt', 'datetime', 'date'),
  column('lastUsedAt', 'datetime', 'date'),
  column('revokedAt', 'datetime', 'date'),
  column('revokeReason', 'string', 'text'),
])
```

Tenant `sessions` are company-scoped membership records that reference the active platform session. They do **not** store refresh tokens; authentication is handled by the linked platform session.

```ts
table('sessions', 'Sessions', [
  column('platformSessionId', 'string', 'text'), // platform sessions:id
  column('memberId', 'record', 'relation'),      // members.id
  column('profileId', 'string', 'text'),         // user_profiles.id (plain string)
  column('email', 'string', 'text'),
  column('companyId', 'string', 'text'),         // companies.id (plain string)
  column('type', 'string', 'select'),            // 'user' | 'impersonation'
  column('impersonatorId', 'record', 'relation'),// members.id, nullable
  // ... device, lastUsedAt, revokedAt, revokeReason
])
```

- `refreshTokenHash` is unique-indexed only in platform `sessions`.
- `company_policies.companyId` is unique.
- Only the hash of refresh tokens is persisted; raw tokens exist only in cookies.
- Tenant sessions are created lazily when a user selects a company.

### `company_policies`

Tenant-level policy/license settings. One row per company.

```ts
table('company_policies', 'Company Policies', [
  column('companyId', 'record', 'relation', { unique: true, config: { relationId: '...' } }),
  column('maxSessions', 'number', 'number'),         // null = unlimited
  column('sessionOverflowAction', 'string', 'select'), // 'revoke_oldest' | 'reject'
  column('allowImpersonation', 'boolean', 'checkbox'),
  column('allowApiKeys', 'boolean', 'checkbox'),
])
```

Defaults:

```ts
{
  maxSessions: null,
  sessionOverflowAction: 'revoke_oldest',
  allowImpersonation: true,
  allowApiKeys: true
}
```

### `api_keys`

Service-account keys scoped to a company.

```ts
table('api_keys', 'API Keys', [
  column('name', 'string', 'text'),
  column('tokenHash', 'string', 'text'),
  column('companyId', 'record', 'relation'),
  column('createdBy', 'record', 'relation'),
  column('scopes', 'array', 'json'),
  column('expiresAt', 'datetime', 'date'),
  column('lastUsedAt', 'datetime', 'date'),
  column('revokedAt', 'datetime', 'date'),
])
```

Initial scopes:

```ts
['users:read', 'users:write', 'workflows:read', 'workflows:write', 'records:read', 'records:write']
```

## Token strategy

### Access token

- Stateless signed object:
  ```ts
  { sessionId, accountId, profileId, companyId?, type, impersonatorId?, jti, exp, iat }
  ```
- Expiry: 15 minutes.
- Signed with `sessionSecret` using existing `packages/shared/src/session.ts` helpers.
- Stored in `tenant_access_token` / `admin_access_token` httpOnly cookie.

### Refresh token

- Random 32-byte token, hashed with SHA-256 before storage.
- Expiry: 7 days, absolute.
- Stored in `tenant_refresh_token` / `admin_refresh_token` httpOnly cookie.
- Rotated on every refresh; reuse detection revokes the whole session family.

### Cookies

| Cookie | Content | HttpOnly | Expiry |
|--------|---------|----------|--------|
| `tenant_access_token` | signed access object | yes | 15 min |
| `tenant_refresh_token` | raw refresh token | yes | 7 days |
| `admin_access_token` | signed access object | yes | 15 min |
| `admin_refresh_token` | raw refresh token | yes | 7 days |
| `company` | company JSON | no | 7 days |

## BFF auth flow

The browser only talks to `apps/api`. The frontend never calls a `/refresh` endpoint or stores tokens in memory.

### Request middleware

1. Read `tenant_access_token` cookie.
2. Unsign and parse; if valid and not expired, attach scope and continue.
3. If access token expired/missing, read `tenant_refresh_token`.
4. Hash refresh token and look up the **platform** `sessions` row.
5. If valid and not revoked/expired:
   - Generate new access token (new `jti`).
   - Rotate refresh token.
   - Update platform `sessions` row.
   - Set updated cookies.
   - Continue.
6. If invalid/expired/revoked, return 401; frontend redirects to `/login`.

### Company sign-in

After login the user has a platform session. To access a company they must sign in to it:

1. Frontend calls `POST /api/auth/company` with `{ companyId, slug }`.
2. Server verifies the platform session.
3. Looks up active `member` record for `profileId` in the company namespace.
4. Checks `company_policies.maxSessions` for that member:
   - If at/over limit, apply `sessionOverflowAction`.
5. Creates a tenant `sessions` row linked to the platform session.
6. Sets the `company` cookie.
7. Subsequent `tenantAuth` routes verify the platform session **and** the active tenant session.

### Login flow

1. Validate credentials.
2. Build device fingerprint from headers + optional `X-Device-Id`.
3. Create a **platform** `sessions` row.
4. Set access/refresh cookies.
5. Return the list of companies the user belongs to.

## Concurrency enforcement

Concurrency is enforced per member per company using tenant sessions:

- `maxSessions: null` → unlimited.
- `maxSessions: 1` → single active company session for the member.
- `sessionOverflowAction: 'revoke_oldest'` → revoke oldest active tenant session(s) for the member.
- `sessionOverflowAction: 'reject'` → return 403.

Global platform-session concurrency is not limited in Phase 1.

## Device fingerprint

Input collected on login:

- `User-Agent`
- `Accept-Language`
- `Sec-CH-UA-Platform` (if available)
- Optional `X-Device-Id` from client localStorage

SHA-256 hash of inputs → `deviceFingerprint`.

`deviceName` is derived from User-Agent for display.

## Login-as (impersonation)

Temporary child session model:

1. Admin calls `POST /api/admin/impersonate` with `{ targetProfileId, companyId? }`.
2. Server validates admin permission and company policy `allowImpersonation`.
3. Creates `sessions` row with:
   - `type: 'impersonation'`
   - `impersonatorId: admin.profileId`
   - `accountId` / `profileId` set to target user
4. Issues access/refresh cookies for impersonation session.
5. UI shows impersonation banner; admin can exit to their own session.

Audit records both `profileId` (target) and `impersonatorId` (admin).

## API key auth

1. Client sends `Authorization: Bearer <token>`.
2. Parse prefix to determine company namespace.
3. Hash token and look up `api_keys`.
4. If valid, build synthetic scope `{ type: 'api_key', companyId, scopes }`.
5. Middleware falls back to cookie session if no API key present.

API keys bypass session concurrency limits.

## Security considerations

- Tokens hashed before DB storage.
- Refresh-token rotation on every use.
- Refresh-token reuse detection is deferred to a future token-family design.
- Short-lived access tokens (15 min).
- HttpOnly cookies prevent XSS theft.
- `SameSite=Lax` mitigates CSRF.
- Rate limiting on login/register endpoints.
- Impersonation always logged with `impersonatorId`.

## Migration

1. Add platform and tenant `sessions` tables plus `company_policies`.
2. Update auth routes to create platform sessions and company sign-in endpoint.
3. Update middleware to validate access/refresh tokens and tenant session records.
4. Old signed `tenant_session` / `admin_session` cookies become invalid; users log in once to obtain new DB-backed session.
5. `api_keys` table is deferred to Phase 3.

## Testing strategy

- Unit: token rotation, fingerprint hashing, concurrency logic.
- Integration: login → access token → refresh → logout.
- Integration: exceed `maxSessions` with `reject` and `revoke_oldest`.
- Integration: impersonation creates audit row.
- Integration: API key auth bypasses cookies and applies scopes.

## Phased implementation

1. **Phase 1:** DB sessions, refresh tokens, BFF middleware, concurrency, device ID.
2. **Phase 2:** Login-as impersonation.
3. **Phase 3:** API keys with scoped permissions.
