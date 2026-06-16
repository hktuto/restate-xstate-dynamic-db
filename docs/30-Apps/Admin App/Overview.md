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
  - [[Roadmap]]
---

# Admin App Overview

## Purpose

The superadmin Nuxt application for platform-level management.

## Key behaviors

- Authenticated via cookie session against `platform_users`.
- Global auth middleware redirects unauthenticated users to `/login`.
- Uses a dedicated `auth.vue` layout for the login page.
- Dashboard shows aggregate stats: companies, workflows, users.
- Server util `health-monitor.ts` runs concurrent health checks for SurrealDB, Restate, workflow-runtime, and web-api.

## Routes

| Route | Purpose |
|-------|---------|
| `/login` | Admin login (uses `auth.vue` layout). |
| `/` | Dashboard with platform stats. |
| `/companies` | Manage companies. |
| `/workflows` | Manage platform workflow templates. |

## Middleware

- `auth.global.ts` — guards all non-login, non-API routes.

## Related

- [[Authentication & Authorization]]
- [[30-Apps/Web App/Overview|Web App]]
- [[Roadmap]]
