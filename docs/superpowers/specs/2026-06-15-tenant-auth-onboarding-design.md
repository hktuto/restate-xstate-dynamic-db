---
title: Tenant Auth & Onboarding Design
type: note
status: in-progress
area: docs
created: 2026-06-15
updated: 2026-06-15
related:
  - [[50-Features/Tenant Authentication & Authorization]]
  - [[50-Features/Company Management]]
  - [[50-Features/User Management]]
  - [[30-Apps/Web App/Overview]]
  - [[30-Apps/Admin App/Overview]]
  - [[20-Architecture/Data Model]]
  - [[20-Architecture/Authentication & Authorization]]
---

# Tenant Auth & Onboarding Design

## Goal

Make the tenant web app fully usable end-to-end by adding public self-service registration, multi-company membership, signed session cookies, and the missing tenant auth pages/API guards.

## Scope

### In scope

- Public `/register` page + API that creates a global `account` and `user_profile`.
- `/login` page + API that authenticates and returns the user’s company list.
- `/companies` page for choosing or creating a company after login.
- `/companies/new` page + API for creating a new company and becoming its owner.
- `/accept-invite` page + API for joining an existing company via invite code.
- `/logout` page/API.
- HMAC-signed `tenant_session` and `admin_session` cookies.
- Separate `company` cookie for selected company context.
- Global web auth middleware that enforces login and company selection.
- `requireTenantSession` / `requireTenantMember` / `requireTenantRole` API guards.
- Remove the superadmin company-creation page/API from the admin app (companies are now created through the web app).
- Input validation for email, password, company name, and slug.

### Out of scope

- Email delivery for invites (invite URL is shown in the UI for copy/share).
- OAuth / SSO.
- Password reset / forgot-password flow.
- RBAC beyond the existing `owner` / `admin` / `member` roles.
- Billing or company approval workflows.

## Architecture

### Session model

Two tenant cookies are used so a user can be authenticated before selecting or creating a company:

- `tenant_session` — HMAC-signed JSON containing `accountId` and `profileId`.
- `company` — contains `companyId` and `slug` for the active company context.

The platform admin app continues to use `admin_session`, which is also HMAC-signed with the same `SESSION_SECRET`.

### Middleware

`apps/web/app/middleware/auth.global.ts`:

1. If no signed `tenant_session` → redirect to `/login`.
2. If `tenant_session` exists but no `company` cookie → redirect to `/companies`.
3. If both exist → load `event.context.account`, `event.context.profile`, and `event.context.member` for API routes.

`apps/web/server/middleware/member.ts` is updated to verify the signed `tenant_session` and resolve the active member from the `company` cookie.

### API guards

- `requireTenantSession(event)` — verifies `tenant_session`, sets `event.context.account` and `event.context.profile`.
- `requireTenantMember(event)` — calls `requireTenantSession`, resolves `event.context.member`, and rejects if `status !== 'active'`.
- `requireTenantRole(event, roles[])` — calls `requireTenantMember` and checks `member.role`.

## Pages and routes

### Web app pages

| Page | Purpose |
|------|---------|
| `/register` | Create account + profile. |
| `/login` | Authenticate; on success redirect to `/companies`. |
| `/companies` | List user’s companies, enter invite code, or create a new company. |
| `/companies/new` | Form to create a new company. |
| `/accept-invite` | Accept invite code, create account/profile if needed, activate member. |
| `/logout` | Clear cookies and redirect to `/login`. |

### API routes

| Route | Guard | Purpose |
|-------|-------|---------|
| `POST /api/auth/register` | public | Create `account` + `user_profile`; set signed `tenant_session`. |
| `POST /api/auth/login` | public | Validate credentials; set signed `tenant_session`; return company list. |
| `POST /api/auth/logout` | public | Clear cookies. |
| `GET /api/companies` | `requireTenantSession` | List companies for current profile. |
| `POST /api/companies` | `requireTenantSession` | Create company + owner member + trigger provisioning. |
| `POST /api/invites` | `requireTenantRole(['owner','admin'])` | Create pending member + invite code. |
| `POST /api/invites/accept` | `requireTenantSession` (if already logged in) or public (if creating account) | Activate member for the invite code. |

### Admin app changes

- Remove `apps/admin/app/pages/companies/index.vue` and `new.vue`.
- Remove `apps/admin/server/api/companies/index.get.ts` and `index.post.ts`.
- Remove company links from admin navigation.
- Keep admin auth routes but sign `admin_session` cookies.

## Data flow

### Sign up

1. User submits email, password, name on `/register`.
2. API validates input and hashes password with bcrypt.
3. API creates `account` (provider `email`) and `user_profile` in the global namespace.
4. API sets signed `tenant_session`.
5. Frontend redirects to `/companies` (empty list).

### Create company

1. User submits company name on `/companies/new`.
2. API normalizes name into a unique slug.
3. API inserts `companies` record in `platform/admin`.
4. API creates `members` record with `role: owner`, `status: active`.
5. API dispatches the existing `provisionCompany` workflow to create the tenant namespace.
6. API sets `company` cookie and redirects to tenant home.

### Log in

1. User submits email/password on `/login`.
2. API validates password against `account`.
3. API loads `user_profile`.
4. API sets signed `tenant_session`.
5. API returns list of companies for the profile.
6. Frontend redirects to `/companies` (or last selected company if one is stored).

### Invite to existing company

1. Owner/admin enters email in members UI.
2. API creates pending `member` with `inviteCode`.
3. UI shows invite URL `/accept-invite?code=xxx`.
4. Recipient visits URL:
   - If not authenticated, show registration form first, then activate.
   - If authenticated, activate member for current profile.

## Security & validation

- `SESSION_SECRET` env var required; used to sign/verify `tenant_session` and `admin_session`.
- Passwords hashed with bcrypt via `packages/shared`.
- Email normalized to lowercase and trimmed.
- Company slug derived from name, lowercased, alphanumeric + hyphen, collision-handled with a suffix.
- Password minimum length enforced on both client and server.
- Rate limiting on `/api/auth/register` and `/api/auth/login` (can be simple in-memory per IP to start).
- `requireTenantMember` rejects `pending` or `inactive` members.
- `requireTenantRole` rejects insufficient roles.

## Files to create or modify

### New files

- `apps/web/app/pages/register.vue`
- `apps/web/app/pages/login.vue`
- `apps/web/app/pages/logout.vue`
- `apps/web/app/pages/companies/index.vue`
- `apps/web/app/pages/companies/new.vue`
- `apps/web/app/pages/accept-invite.vue`
- `apps/web/app/middleware/auth.global.ts`
- `apps/web/server/api/auth/register.post.ts`
- `apps/web/server/api/auth/logout.post.ts`
- `apps/web/server/api/companies/index.get.ts`
- `apps/web/server/api/companies/index.post.ts`
- `apps/web/server/api/invites/index.post.ts`
- `apps/web/server/api/invites/accept.post.ts`
- `packages/shared/src/session.ts` (sign/verify helpers)

### Modified files

- `.env.example` — add `SESSION_SECRET`.
- `apps/web/server/api/auth/login.post.ts` — sign session, return companies.
- `apps/web/server/utils/auth.ts` — use signed cookies.
- `apps/web/server/middleware/member.ts` — verify signed session.
- `apps/web/app/middleware/company.global.ts` — replaced by `auth.global.ts`.
- `apps/web/server/api/workflows/*.ts` — add guards.
- `apps/web/server/api/triggers/*.ts` — add guards.
- `apps/web/server/api/users/*.ts` — add guards and fix invite code exposure.
- `apps/admin/server/utils/session.ts` — sign `admin_session`.
- `apps/admin/server/api/auth/login.post.ts` — sign cookie.
- `apps/admin/app/middleware/auth.global.ts` — verify signed cookie.
- `apps/admin/app/pages/companies/index.vue` — delete.
- `apps/admin/app/pages/companies/new.vue` — delete.
- `apps/admin/server/api/companies/*.ts` — delete.
- `packages/db/src/platform.ts` — add slug uniqueness helpers if needed.

## Testing

- Unit tests for slug normalization and session sign/verify helpers.
- API tests for register → login → create company → access guarded route.
- API tests for invite flow: invite → accept → member becomes active.
- Tests that unauthenticated requests to `/api/workflows/*` return 401.
- Tests that inactive/pending members cannot access tenant data.
- Manual smoke test: register a user, create a company, log out, log back in, verify company selector.

## Related

- [[50-Features/Tenant Authentication & Authorization|Tenant Authentication & Authorization]]
- [[50-Features/Company Management|Company Management]]
- [[50-Features/User Management|User Management]]
- [[30-Apps/Web App/Overview|Web App]]
- [[30-Apps/Admin App/Overview|Admin App]]
- [[20-Architecture/Data Model|Data Model]]
- [[20-Architecture/Authentication & Authorization|Authentication & Authorization]]
