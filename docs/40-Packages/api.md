---
title: API
type: package
status: done
area: architecture
created: 2026-06-15
updated: 2026-06-19
related:
  - [[40-Packages/db]]
  - [[30-Apps/web]]
  - [[30-Apps/admin]]
  - [[50-Features/Tenant Authentication & Authorization]]
  - [[50-Features/Company Management]]
  - [[50-Features/Workflow Engine]]
  - [[50-Features/User Tasks]]
  - [[50-Features/Admin Health Monitor]]
---

# API

The `apps/api` package is a dedicated Hono service that exposes the dynamic table/schema query API and all remaining business endpoints for both the tenant web app and the admin app.

## Routes

### Tables

- `GET /api/tables` — list user tables (tenant scope)
- `GET /api/tables/:table` — get table schema (tenant scope)
- `POST /api/tables/:table/sync` — sync schema from existing records (tenant scope)
- `POST /api/tables/:table/query` — paginated record query (tenant scope)
- `POST /api/tables/:table/columns` — upsert a column definition (tenant scope)

Admin table routes use an explicit `namespace--database` key:

- `GET /api/admin/tables/:nsdb`
- `GET /api/admin/tables/:nsdb/:table`
- `POST /api/admin/tables/:nsdb/:table/sync`
- `POST /api/admin/tables/:nsdb/:table/query`
- `POST /api/admin/tables/:nsdb/:table/columns`

### Auth

Auth endpoints are served by `apps/api` so the Nuxt frontends can call a single API service:

- `POST /api/auth/login` — tenant login
- `POST /api/auth/register` — tenant registration
- `POST /api/auth/logout` — clear tenant cookies
- `POST /api/auth/accept-invite` — accept a company invite
- `POST /api/auth/admin/login` — admin login
- `POST /api/auth/admin/logout` — clear admin cookie
- `GET /api/auth/admin/me` — return current admin session

### Tenant

- `GET /api/companies` — list companies for the current profile
- `POST /api/companies` — create a company
- `GET /api/users` — list company members
- `POST /api/users` — invite a member
- `PATCH /api/users/:id` — update a member
- `DELETE /api/users/:id` — delete a member
### Workflow designs

- `GET /api/workflow-designs` — list workflow designs
- `POST /api/workflow-designs` — create a workflow design
- `GET /api/workflow-designs/:id` — get a workflow design
- `PATCH /api/workflow-designs/:id` — update a workflow design
- `DELETE /api/workflow-designs/:id` — delete a workflow design
- `GET /api/user-tasks` — list pending user tasks
- `POST /api/user-tasks/:id/approve` — approve a user task
- `POST /api/user-tasks/:id/reject` — reject a user task

### Public

- `GET /api/health` — health check
- `GET /api/platform-status` — platform status from health checks
- `POST /api/webhook` — generic webhook receiver
- `PATCH /api/workflow-instances/:id/status` — update workflow instance status
- `POST /api/user-tasks` — create a user task

### Admin

- `GET /api/admin/workflow-designs` — list platform workflow designs
- `POST /api/admin/workflow-designs` — create a platform workflow design
- `GET /api/admin/workflow-designs/:id` — get a platform workflow design
- `PATCH /api/admin/workflow-designs/:id` — update a platform workflow design
- `DELETE /api/admin/workflow-designs/:id` — delete a platform workflow design
- `GET /api/admin/health-checks` — latest health checks
- `GET /api/admin/health-checks/history` — health check history for a service
- `GET /api/admin/dashboard` — dashboard stats

## Auth

Tenant routes read `tenant_session` and `company` cookies and verify the active member. Admin routes read `admin_session`; table routes parse the `nsdb` path parameter, while platform-scoped admin routes default to the `platform/admin` namespace/database.

## Run locally

```bash
pnpm --filter api dev
```
