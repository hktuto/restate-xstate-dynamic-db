---
title: E2E API Tests Design
type: note
status: in-progress
area: docs
created: 2026-06-19
updated: 2026-06-20
related:
  - [[50-Features/Tenant Authentication & Authorization]]
  - [[40-Packages/db]]
  - [[30-Apps/api]]
---

# E2E API Tests Design

## Goal

Add a comprehensive end-to-end API test suite under `apps/api/tests/e2e/` that exercises the full request lifecycle — real login, cookie-based sessions, middleware auth/permissions, and CRUD on every major resource — so we can confidently refactor and build the frontend on a solid foundation.

## Scope

### In scope

- Authentication and session lifecycle (tenant and admin).
- Company creation and selection.
- User invitation, role updates, removal.
- User groups and group membership.
- Permission checks (owner bypass, member restrictions, actions list).
- Tenant and admin table management.
- Tenant workflow-design CRUD and role restrictions.
- Admin endpoints (dashboard, health checks, admin workflow designs).

### Out of scope

- Workflow runtime / Restate integration (starting instances, waiting for completion, user-task approvals).
- Service-account API keys.
- Login-as impersonation.
- UI/frontend behavior.

These will be covered in separate test suites when implemented.

## Architecture

The suite runs against the real `Hono` app (`createApp()`) and a live SurrealDB instance, matching the existing `apps/api/tests/tables.test.ts` pattern.

- **Real login:** tests call `POST /api/login` and `POST /api/admin/login` with real passwords, receiving `httpOnly` cookies.
- **Shared fixture:** a single `fixtures.ts` seeds one test company with an owner, an admin, and a member, plus default permission groups.
- **Isolation:** each test file uses a uniquely-named namespace to avoid collisions during parallel runs.
- **Cleanup:** `afterAll` removes the tenant namespace and deletes seeded platform records.

## File structure

```
apps/api/tests/e2e/
├── fixtures.ts                   # shared seed data + login helpers
├── auth.e2e.test.ts              # login, register, logout, company selection, accept invite
├── companies.e2e.test.ts         # create/list companies
├── users.e2e.test.ts             # list, invite, update, delete members
├── user-groups.e2e.test.ts       # CRUD groups + group membership
├── permissions.e2e.test.ts       # permission actions + effective checks
├── tables.e2e.test.ts            # tenant/admin table CRUD
├── workflow-designs.e2e.test.ts  # tenant workflow design CRUD
└── admin.e2e.test.ts             # admin dashboard, health, admin workflow designs
```

## Shared fixture (`fixtures.ts`)

### Seeded data

One test company is created per test file invocation:

| User | Email | Role | Purpose |
|---|---|---|---|
| Owner | `owner-{ns}@test.co` | `owner` | unrestricted company access |
| Admin | `admin-{ns}@test.co` | `member` in default admin group | permission-bypass checks |
| Member | `member-{ns}@test.co` | `member` | restricted-access checks |

Each user has:
- a `user_profiles` record,
- an `accounts` record with `provider: 'email'` and a hashed password,
- an active `members` record in the company namespace,
- membership in the default owner/admin groups where appropriate.

The fixture also seeds one platform admin user for `/api/admin/*` tests.

### Exports

```ts
export const testCompany: CompanyRecord
export const ownerUser: SeededUser
export const adminUser: SeededUser
export const memberUser: SeededUser
export const platformAdminUser: SeededUser

export async function loginTenant(email: string, password: string): Promise<{ cookies: string }>
export async function loginAdmin(email: string, password: string): Promise<{ cookies: string }>
export function tenantCookieHeader(accessToken: string, company: TenantCompanyCookie): string
export function adminCookieHeader(accessToken: string): string
```

`loginTenant` returns the raw `Set-Cookie` value(s) from `POST /api/login`; callers can pass it directly to `app.request({ headers: { Cookie: cookies } })`.

## Test scenarios

### `auth.e2e.test.ts`

- `POST /api/login` succeeds with valid owner credentials and returns companies.
- `POST /api/login` fails with invalid password (401).
- `POST /api/register` creates a new account and returns `companies: []`.
- `POST /api/company` succeeds for an authenticated tenant and sets the company cookie.
- `POST /api/company` fails without a platform session (401).
- `POST /api/company` fails for a company the user is not an active member of (403).
- `POST /api/logout` revokes the platform session and clears cookies.
- `POST /api/admin/login` succeeds for a platform admin.
- `POST /api/admin/logout` clears admin cookies.
- `GET /api/admin/me` returns authenticated user after admin login.
- `POST /api/accept-invite` activates a pending member and sets cookies.

### `companies.e2e.test.ts`

- `POST /api/companies` creates a company and makes the caller the owner.
- `GET /api/companies` lists companies the current profile is a member of.

### `users.e2e.test.ts`

- `GET /api/users` lists members with profiles.
- `POST /api/users` invites a new member by email (owner/admin only).
- `POST /api/users` is rejected for a plain member (403).
- `PATCH /api/users/:id` updates a member's role.
- `PATCH /api/users/:id` blocks self-demotion/deactivation.
- `DELETE /api/users/:id` removes a member.

### `user-groups.e2e.test.ts`

- `GET /api/user-groups` lists groups.
- `POST /api/user-groups` creates a group.
- `GET /api/user-groups/:id` returns the group.
- `PATCH /api/user-groups/:id` updates name/description.
- `POST /api/user-groups/:id/members` adds a member.
- `GET /api/user-groups/:id/members` lists member IDs.
- `DELETE /api/user-groups/:id/members/:memberId` removes a member.
- `DELETE /api/user-groups/:id` deletes the group.
- All write actions are rejected for a plain member (403).

### `permissions.e2e.test.ts`

- `GET /api/permissions/actions?resourceType=company` returns action bit values.
- Owner can invite members without explicit permission grants.
- Plain member cannot invite members (403).

### `tables.e2e.test.ts`

- `GET /api/tables` lists tenant tables.
- `GET /api/tables/:table` returns table schema.
- `POST /api/tables/:table/query` returns records.
- `POST /api/admin/tables/:nsdb/query` returns records for admin.
- Admin table endpoints reject invalid `nsdb` format (400).

### `workflow-designs.e2e.test.ts`

- `GET /api/workflow-designs` lists designs.
- `POST /api/workflow-designs` creates a design (owner/admin only).
- `PATCH /api/workflow-designs/:id` updates a design (owner/admin only).
- `DELETE /api/workflow-designs/:id` deletes a design (owner/admin only).
- Plain member cannot create/update/delete designs (403).

### `admin.e2e.test.ts`

- `GET /api/admin/dashboard` returns counts.
- `GET /api/admin/health-checks` returns latest checks.
- `GET /api/admin/health-checks/history?service=surrealdb` returns history.
- `GET /api/admin/workflow-designs` lists platform designs.
- `POST /api/admin/workflow-designs` creates a platform design.
- `PATCH /api/admin/workflow-designs/:id` updates it.
- `DELETE /api/admin/workflow-designs/:id` deletes it.
- Admin endpoints reject unauthenticated requests (401).

## Assertions

- HTTP status codes match expected outcomes.
- Response bodies contain expected shapes/IDs.
- State changes are observable in subsequent requests (e.g., after inviting a user, the user list includes the new member).
- Permission failures return 403 with a clear error message.

## Cleanup

Each test file:

1. In `beforeAll`, seeds platform records and the tenant namespace.
2. In `afterAll`, removes the tenant namespace and deletes seeded platform records.

The fixture exposes `cleanup()` for test files that need to reset state between describe blocks.

## Execution

```bash
pnpm --filter api test
```

The existing `vitest.config.ts` in `apps/api` already runs `tests/**/*.test.ts`, so the new `e2e/*.test.ts` files will be picked up automatically.

SurrealDB must be running (the same requirement as `packages/db` tests).

## Future work

- Add workflow-runtime smoke tests once the frontend foundation is solid.
- Add API-key auth tests when API keys are implemented.
- Add impersonation audit tests when login-as is implemented.
