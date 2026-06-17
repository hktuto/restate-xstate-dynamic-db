---
title: Web App Overview
type: app
status: done
area: web
created: 2026-06-14
updated: 2026-06-16
app:
  - web
related:
  - [[Multi-tenancy]]
  - [[30-Apps/Admin App/Overview]]
  - [[40-Packages/workflow-editor-layer]]
  - [[50-Features/Admin Health Monitor]]
---

# Web App Overview

## Purpose

The tenant-facing Nuxt application. Each user belongs to a company and manages workflows within that tenant context.

## Key behaviors

- Company context resolved from `company_slug` cookie or `x-company-namespace` header.
- `/` is company-agnostic and lets users select or switch companies.
- All other pages require a resolved company; missing context redirects to `/`.
- Extends `layers/workflow-editor` for the workflow designer.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Company selection / landing. |
| `/workflows` | List company workflows. |
| `/workflows/[id]` | Edit a workflow in the visual editor. |
| `/maintenance` | Maintenance page shown when critical services are unhealthy. |
| `/api/companies` | List companies (public within session). |
| `/api/health` | Public health check. |
| `/api/platform-status` | Current platform mode derived from health checks. |

## Middleware

- `company.ts` — resolves company context, skipping company-agnostic routes.
- `platform-status.global.ts` — redirects client navigations to `/maintenance` when critical services are down.

## Platform status

The web app reads the latest health checks written by the admin health monitor and reacts to them:

- `normal` — no UI impact.
- `degraded` — a global banner warns that some features (e.g., workflows) are temporarily unavailable.
- `maintenance` — non-API routes redirect to `/maintenance` and return HTTP 503.

See [[50-Features/Admin Health Monitor]] for how checks are produced.

## Related

- [[Multi-tenancy]]
- [[30-Apps/Admin App/Overview|Admin App]]
- [[40-Packages/workflow-editor-layer|workflow-editor-layer]]
