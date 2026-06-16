---
title: Admin App Overview
type: app
status: done
area: admin
created: 2026-06-14
updated: 2026-06-16
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

- Authenticated via cookie session against `platform_users`.
- Global auth middleware redirects unauthenticated users to `/login`.
- Uses a dedicated `auth.vue` layout for the login page.
- Dashboard shows aggregate stats: companies, workflows, users.
- The `/health` page reads health-check records written by the standalone [[30-Apps/Health Monitor/Overview|health-monitor service]].
- Record IDs in page links and `$fetch` calls are wrapped with `encodeURIComponent`; server `[id]` routes decode them with `getRouterParam(event, 'id', { decode: true })`.

## Routes

| Route | Purpose |
|-------|---------|
| `/login` | Admin login (uses `auth.vue` layout). |
| `/` | Dashboard with platform stats. |
| `/companies` | Manage companies. |
| `/workflows` | Manage platform workflow templates. |
| `/health` | Service health monitor. |

## Middleware

- `auth.global.ts` — guards all non-login, non-API routes.

## Related

- [[Authentication & Authorization]]
- [[30-Apps/Web App/Overview|Web App]]
- [[Roadmap]]
