---
title: Admin Health Monitor Design
type: note
status: in-progress
area: docs
created: 2026-06-15
updated: 2026-06-16
related:
  - [[30-Apps/Admin App/Overview]]
  - [[20-Architecture/System Overview]]
  - [[40-Packages/db]]
  - [[70-Operations/Restate Operations]]
---

# Admin Health Monitor Design

## Goal

Give superadmins a live view of platform service health. A scheduler runs periodic checks, stores results in SurrealDB, and the admin app displays the latest status plus recent history.

## Scope

### In scope

- Health checks for:
  - SurrealDB
  - Restate
  - `workflow-runtime`
  - web API
- Config validation (env vars, reachable URLs, functional behavior).
- Background scheduler inside the admin app.
- Storage of check results in `platform/admin.health_checks`.
- Admin page showing current status and history.
- Manual refresh button.

### Out of scope

- Alerts/notifications (schema supports it later).
- Checking every possible integration (expand later).
- Standalone Docker scheduler (extraction path is documented).

## Architecture

```text
┌─────────────────┐     setInterval      ┌─────────────────────────────┐
│  Admin server   │ ───────────────────> │  Health check runner        │
│  (Nuxt/Nitro)   │                      │  (server/utils/health-monitor)│
└─────────────────┘                      └─────────────────────────────┘
         │                                            │
         │ reads                                      │ writes
         ▼                                            ▼
┌─────────────────┐                          ┌─────────────────┐
│  Admin health   │                          │  health_checks  │
│  page (health.vue)│                         │  (platform/admin)│
└─────────────────┘                          └─────────────────┘
```

## Service checks

| Service | Endpoint / action | Expected result |
|---------|-------------------|-----------------|
| SurrealDB | Connect via `getSurreal('platform', 'admin')`, run `SELECT 1 FROM 1` | Query succeeds |
| Restate | `GET ${RESTATE_META_URL}/services` | HTTP 200 |
| workflow-runtime | `GET ${WORKFLOW_RUNTIME_URL}/health` | HTTP 200 |
| web API | `GET ${WEB_API_URL}/api/health` | HTTP 200 |

New health endpoints to add:

- `apps/workflow-runtime/src/index.ts` — mount `GET /health` alongside the Restate handler. The Restate SDK's `endpoint().handler()` can be wrapped in a small Node HTTP server so that `/health` returns `{ status: 'ok' }` and all other paths are handled by Restate.
- `apps/web/server/api/health.get.ts` — returns `{ status: 'ok' }` without requiring auth.

## Configuration

New environment variables with defaults:

```bash
RESTATE_META_URL=http://localhost:9070
WORKFLOW_RUNTIME_URL=http://localhost:9080
WEB_API_URL=http://localhost:3000
HEALTH_CHECK_INTERVAL_MS=60000
HEALTH_CHECK_HISTORY_LIMIT=100
```

Config validation is part of each service check: if a required env var is missing, the check is marked `unhealthy` with a message like `Missing WORKFLOW_RUNTIME_URL`.

## Data model

Table: `health_checks` in namespace `platform`, database `admin`.

```ts
interface HealthCheckRecord {
  id: string
  service: 'surrealdb' | 'restate' | 'workflow-runtime' | 'web-api'
  status: 'healthy' | 'unhealthy'
  checkedAt: string
  responseTimeMs: number
  message?: string
  details?: Record<string, unknown>
}
```

## Scheduler

File: `apps/admin/server/plugins/health-monitor-scheduler.ts`

- Starts a `setInterval` loop when the Nitro server boots.
- On each tick:
  1. Run all service checks concurrently.
  2. Insert one `health_checks` record per service.
  3. Prune old records, keeping the latest `HEALTH_CHECK_HISTORY_LIMIT` per service.
- Does not block server startup; errors are logged but not thrown.

## Admin API

- `GET /api/health-checks`
  - Returns `{ latest: HealthCheckRecord[], history: HealthCheckRecord[] }`.
  - `latest` contains the most recent record per service.
  - `history` contains the last `HEALTH_CHECK_HISTORY_LIMIT` records across all services, sorted by `checkedAt` descending.

- `POST /api/health-checks/run`
  - Manually triggers one check run.
  - Requires admin session.
  - Returns the newly created records.

## Admin UI

New page: `/health` in `apps/admin/app/pages/health.vue`.

- Add a "Health" link in the default layout nav.
- Display a status card for each service:
  - service name
  - current status (green/red badge)
  - last checked time
  - response time
  - error message if unhealthy
- Display a history table with columns:
  - service
  - status
  - checked at
  - response time
  - message
  - details (expandable)
- Manual "Run checks now" button that calls `POST /api/health-checks/run` and refreshes data.

## Error handling

- A failed check is stored as `status: 'unhealthy'` with the error message in `message`.
- Network timeouts should be capped (e.g., 5000ms) so one slow service does not block all checks.
- Scheduler errors are caught and logged; they do not crash the admin server.

## Retention

After each run, delete records per service beyond the configured `HEALTH_CHECK_HISTORY_LIMIT`. This keeps the table bounded.

## Extraction path

When the admin app is scaled behind a load balancer, the in-process scheduler would cause duplicate checks. To move to a standalone service:

1. Create a new `services/health-monitor` package.
2. Move `server/utils/health-monitor.ts` and the scheduler loop into it.
3. Keep the DB schema and write logic identical.
4. Remove `apps/admin/server/plugins/health-monitor-scheduler.ts`.
5. Admin app keeps only the API routes and the UI.

## Files to create or modify

### New files

- `apps/admin/server/plugins/health-monitor-scheduler.ts`
- `apps/admin/server/utils/health-monitor.ts`
- `apps/admin/server/api/health-checks/index.get.ts`
- `apps/admin/server/api/health-checks/run.post.ts`
- `apps/admin/app/pages/health.vue`
- `apps/workflow-runtime/src/health.ts`
- `apps/web/server/api/health.get.ts`
- `packages/db/src/health-checks.ts`
- `docs/50-Features/Admin Health Monitor.md`
- `docs/30-Apps/Admin App/Overview.md` (add route)

### Modified files

- `apps/admin/app/layouts/default.vue` — add Health nav link.
- `apps/workflow-runtime/src/index.ts` — restructure to mount both the Restate handler and `GET /health` on the same port.
- `.env.example` — add new env vars.
- `docker-compose.yml` — ensure admin/workflow-runtime/web can reach each other by service name in production (document only; no change needed for local dev).

## Testing

- Unit test the check runner with mocked fetch and SurrealDB connection.
- Manually verify the admin page shows all services and that `POST /api/health-checks/run` updates the table.
- Test unhealthy scenarios by stopping one Docker service.

## Related

- [[30-Apps/Admin App/Overview|Admin App]]
- [[20-Architecture/System Overview|System Overview]]
- [[40-Packages/db|db package]]
- [[70-Operations/Restate Operations|Restate Operations]]
