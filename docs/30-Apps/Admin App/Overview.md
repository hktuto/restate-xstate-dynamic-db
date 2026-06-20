---
title: Admin App Overview
type: app
status: done
area: admin
created: 2026-06-14
updated: 2026-06-19
app:
  - admin
related:
  - [[Authentication & Authorization]]
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
- Global auth middleware redirects unauthenticated users to `/login`.
- Uses a dedicated `auth.vue` layout for the login page.
- Dashboard shows aggregate stats: companies, workflow designs, and triggers. The trigger count is derived from the number of `db_trigger` start rules across all platform workflow designs.
- The `/health` page reads health-check records written by the standalone [[30-Apps/Health Monitor/Overview|health-monitor service]].

## Routes

| Route | Purpose |
|-------|---------|
| `/login` | Admin login (uses `auth.vue` layout). |
| `/` | Dashboard with platform stats. |
| `/companies` | Manage companies. |
| `/workflow-designs` | Manage platform workflow designs; detail page can run a user trigger from generated start-state inputs. |
| `/triggers` | Manage platform db-trigger start rules on workflow designs. |
| `/health` | Service health monitor. |

## Middleware

- `auth.global.ts` — guards all non-login, non-API routes.

## Related

- [[Authentication & Authorization]]
- [[30-Apps/Web App/Overview|Web App]]
- [[Roadmap]]
