---
title: Admin App Overview
type: app
status: done
area: admin
created: 2026-06-14
updated: 2026-06-21
app:
  - admin
related:
  - [[Admin Authentication & Authorization]]
  - [[30-Apps/Web App/Overview]]
  - [[30-Apps/Health Monitor/Overview]]
  - [[Roadmap]]
  - [[50-Features/Admin Health Monitor]]
---

# Admin App Overview

## Purpose

The superadmin Nuxt application for platform-level management.

## Key behaviors

- Authenticated via cookie session against `platform_users`; login/logout are handled by the API service (`apps/api`) through `useApi().fetch()`.
- Access tokens expire after **15 minutes**; refresh tokens are valid for **7 days** and reset their expiry on each refresh.
- `GET /api/admin/me` runs the admin session middleware, so it auto-refreshes an expired access token as long as the refresh token is still valid.
- Auth state is encapsulated in the `useAuth()` composable (`apps/admin/app/composables/useAuth.ts`). It tracks `user`, `authenticated`, and `initialized` in `useState`. `init()` fetches `/api/admin/me` only when `initialized` is `false`, so subsequent client-side navigations reuse the cached state. `login()` resets `initialized` so the next `init()` call fetches the freshly authenticated user.
- Global auth middleware redirects unauthenticated users to `/login` and redirects authenticated users away from `/login` to `/`.
- Uses a dedicated `auth.vue` layout for the login page.
- Dashboard layout follows the Nuxt UI dashboard template: a collapsible, resizable `UDashboardSidebar` with the brand in the sidebar header, and a `UDashboardSidebarCollapse` toggle in each page’s `UDashboardNavbar`.
- Color mode is supported via Nuxt UI / `@nuxtjs/color-mode`. A light/dark toggle lives under **Appearance** in the profile dropdown menu.
- Dashboard shows aggregate stats: companies, workflow designs, and triggers. The trigger count is derived from the number of `db_trigger` start rules across all platform workflow designs.
- The `/users` page lists platform admin users, allows creating and editing them, and supports assigning users to multiple admin user groups via graph-edge memberships.
- The `/user-groups` page manages admin user groups.
- The `/health` page reads health-check records written by the standalone [[30-Apps/Health Monitor/Overview|health-monitor service]].

## Routes

| Route | Purpose |
|-------|---------|
| `/login` | Admin login (uses `auth.vue` layout). |
| `/` | Dashboard with platform stats. |
| `/companies` | Manage companies. |
| `/users` | List, add, and edit platform admin users. |
| `/user-groups` | List, add, and edit admin user groups. |
| `/workflow-designs` | Manage platform workflow designs; detail page can run a user trigger from generated start-state inputs. |
| `/triggers` | Manage platform db-trigger start rules on workflow designs. |
| `/health` | Service health monitor. |

## Middleware

- `auth.global.ts` — initializes `useAuth()` if needed, redirects authenticated users away from `/login`, and redirects unauthenticated users to `/login` for all other routes.

## Related

- [[Admin Authentication & Authorization]]
- [[30-Apps/Web App/Overview|Web App]]
- [[Roadmap]]
