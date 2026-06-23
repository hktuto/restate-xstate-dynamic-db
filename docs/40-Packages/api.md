---
title: API
type: package
status: in-progress
area: architecture
created: 2026-06-15
updated: 2026-06-21
related:
  - [[40-Packages/db]]
  - [[30-Apps/web]]
  - [[30-Apps/admin]]
  - [[50-Features/Tenant Authentication & Authorization]]
  - [[50-Features/Company Management]]
  - [[50-Features/Workflow Engine]]
  - [[50-Features/User Tasks]]
  - [[50-Features/Admin Health Monitor]]
  - [[50-Features/Views]]
---

# API

The `apps/api` package is a dedicated Hono service that exposes the dynamic table/schema query API and all remaining business endpoints for both the tenant web app and the admin app.

## Routes

### Tables

- `GET /api/tables` — list user tables (tenant scope)
- `GET /api/tables/:table` — get table schema (tenant scope)
- `POST /api/tables/:table/sync` — sync schema from existing records (tenant scope)
- `POST /api/tables/:table/query` — paginated record query with optional filter, sort, and column projection (tenant scope)
- `POST /api/tables/:table/columns` — upsert a column definition (tenant scope)

Admin table routes use an explicit `namespace--database` key:

- `GET /api/admin/tables/:nsdb`
- `GET /api/admin/tables/:nsdb/:table`
- `POST /api/admin/tables/:nsdb/:table/sync`
- `POST /api/admin/tables/:nsdb/:table/query` — paginated record query with optional filter, sort, and column projection
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

## Table query builder

The table query endpoint uses `apps/api/src/routes/table-query-builder.ts` to safely translate a JSON body into SurrealQL:

```ts
interface QueryBody {
  page?: number
  pageSize?: number
  filter?: FilterGroup
  sort?: SortSetting[]
  columns?: TableColumnConfig[]
}
```

- Field names, table names, and operators are validated against allow-lists before interpolation.
- Values are passed as SurrealDB bound parameters (`$v0`, `$v1`, …) to avoid injection.
- Sort fields that are not registered in the table schema are ignored.
- Sort fields are always added to the `SELECT` projection because SurrealDB requires `ORDER BY` fields to appear in the selection.
- The endpoint returns `{ records, total }`; the `total` query applies the same `WHERE` clause as the records query.

## Auth

Tenant routes read `tenant_session` and `company` cookies and verify the active member. Admin routes read `admin_session`; table routes parse the `nsdb` path parameter, while platform-scoped admin routes default to the `platform/admin` namespace/database.

## Environment

The API reads `SESSION_SECRET` from the root `.env` file at startup. The `dev` and `start` scripts load it via Node's `--env-file` flag:

```json
{
  "dev": "tsx watch --env-file ../../.env src/index.ts",
  "start": "tsx --env-file ../../.env src/index.ts"
}
```

If `SESSION_SECRET` is not set, the process throws `Error: SESSION_SECRET is required`.

## Run locally

```bash
pnpm --filter api dev
```

## Tests

```bash
# Requires surrealdb-test on port 8001
docker compose up -d surrealdb-test
pnpm --filter api test
```

The API test suite extends the shared `vitest.base.config.ts`, which loads `.env.test` and points `SURREAL_URL` at the test SurrealDB instance. E2E fixtures create unique `e2e_*` namespaces and clean them up after each test.
