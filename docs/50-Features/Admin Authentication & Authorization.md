---
title: Admin Authentication & Authorization
type: feature
status: planned
area: workflow
created: 2026-06-21
updated: 2026-06-21
related:
  - [[Tenant Authentication & Authorization]]
  - [[30-Apps/Admin App/Overview]]
  - [[Data Model]]
  - [[User Management]]
---

# Admin Authentication & Authorization

Platform administrators authenticate through a signed cookie session managed by the API service (`apps/api`). The admin Nuxt app (`apps/admin`) keeps auth state in the `useAuth()` composable and guards routes with a global middleware.

## Auth flows

1. **Log in** (`/login`) — submits email/password to `/api/admin/login`, then calls `useAuth().init()` to fetch the current user from `/api/admin/me`.
2. **Session validation** — `GET /api/admin/me` runs the admin session middleware, which auto-refreshes an expired access token when the refresh token is still valid.
3. **Log out** — calls `/api/admin/logout`, clears local auth state, and redirects to `/login`.

## `useAuth()` composable

Located at `apps/admin/app/composables/useAuth.ts`.

- `user` — the current `AdminUser` (`{ userId, email }`) or `null`.
- `authenticated` — whether the current session is valid.
- `initialized` — whether `/api/admin/me` has been fetched at least once during this session. Prevents repeated fetches on client-side navigations.
- `init()` — fetches `/api/admin/me` only when `initialized` is `false`, then sets `user`, `authenticated`, and `initialized`.
- `login(credentials)` — resets `initialized` to `false`, posts to `/api/admin/login`, then calls `init()` so the freshly created session is immediately reflected.
- `logout()` — posts to `/api/admin/logout`, clears `user`/`authenticated`/`initialized`, and redirects to `/login`.

## Global middleware

`apps/admin/app/middleware/auth.global.ts`:

- Initializes auth state with `useAuth().init()` if it has not been initialized yet.
- On `/login`, redirects authenticated users to `/` so they cannot reach the login page while already logged in.
- On all other routes, redirects unauthenticated users to `/login`.

## Session cookies

- `admin_session` — HMAC-SHA256 signed JSON cookie containing the admin user identity.
- Access tokens expire after **15 minutes**; refresh tokens are valid for **7 days** and reset their expiry on each refresh.
- `SESSION_SECRET` is required in the environment.

## Related

- [[Tenant Authentication & Authorization]]
- [[30-Apps/Admin App/Overview|Admin App Overview]]
- [[User Management]]
