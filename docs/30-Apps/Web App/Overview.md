---
title: Web App Overview
type: app
status: done
area: web
created: 2026-06-14
updated: 2026-06-14
app:
  - web
related:
  - [[Multi-tenancy]]
  - [[30-Apps/Admin App/Overview]]
  - [[40-Packages/workflow-editor-layer]]
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
| `/api/companies` | List companies (public within session). |

## Middleware

- `company.global.ts` — resolves company context.

## Related

- [[Multi-tenancy]]
- [[30-Apps/Admin App/Overview|Admin App]]
- [[40-Packages/workflow-editor-layer|workflow-editor-layer]]
