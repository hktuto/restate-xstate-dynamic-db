---
title: Web App Overview
type: app
status: done
area: web
created: 2026-06-14
updated: 2026-06-19
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

- Authentication is handled by the API service (`apps/api`); the web app calls `/api/auth/*` through `useApi().fetch()`.
- Company context resolved from `company` cookie or `x-company-namespace` header.
- `/` is company-agnostic and lets users select or switch companies.
- All other pages require a resolved company; missing context redirects to `/`.
- Extends `layers/workflow-editor` for the workflow designer.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Company selection / landing. |
| `/workflow-designs` | List company workflow designs. |
| `/workflow-designs/new` | Create a new workflow design. |
| `/workflow-designs/[id]` | Edit a workflow design in the visual editor. |
| `/triggers` | List and manage workflow-design start rules. |
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
