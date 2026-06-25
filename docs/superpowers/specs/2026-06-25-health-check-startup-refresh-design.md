---
title: Health Check Startup Refresh Design
type: note
status: in-progress
area: docs
created: 2026-06-25
updated: 2026-06-25
related:
  - [[50-Features/Admin Health Monitor]]
  - [[30-Apps/Health Monitor/Overview]]
  - [[30-Apps/Admin App/Overview]]
  - [[2026-06-15-standalone-health-monitor-service-design]]
---

# Health Check Startup Refresh Design

## Goal

Let other services ask the standalone `health-monitor` service to run health checks immediately instead of waiting for its scheduler interval. The API server triggers a refresh on startup so the admin health page shows current status right away.

## Scope

### In scope

- Add a `Bun.serve` HTTP endpoint to `apps/health-monitor` that accepts a refresh request.
- Accept an optional `service` parameter to refresh one service or all services.
- Trigger a refresh from `apps/api` when the server finishes starting.
- Add `POST /api/admin/health-checks/refresh` to forward refresh requests to `health-monitor`.
- Add a **Refresh now** button to the admin `/health` page.
- Add `HEALTH_MONITOR_URL` and `HEALTH_MONITOR_PORT` to `.env.example`.

### Out of scope

- Removing or changing the existing scheduler loop in `health-monitor`.
- Changing how checks are run or what they verify.
- Authentication on the `health-monitor` HTTP endpoint (it is an internal service).
- Adding tRPC, gRPC, or a message queue for this single endpoint.

## Architecture

```text
┌─────────────┐     POST /refresh          ┌─────────────────────┐
│  API        │ ─────────────────────────> │  health-monitor     │
│  server     │                            │  (Bun scheduler +   │
└─────────────┘                            │   Bun.serve)        │
       │                                   └─────────────────────┘
       │                                          │
       │ startup trigger                          │ checks + writes
       ▼                                          ▼
┌─────────────┐                            ┌─────────────────────┐
│  Admin UI   │                            │  health_checks      │
│  /health    │                            │  (SurrealDB)        │
└─────────────┘                            └─────────────────────┘
```

## `apps/health-monitor` changes

### New `Bun.serve` HTTP server in `src/index.ts`

Alongside the scheduler loop, start `Bun.serve` on `HEALTH_MONITOR_PORT` (default `3010`).

Handle:

```ts
POST /refresh
```

Request body (optional):

```json
{ "service": "api" }
```

Behavior:

1. Parse JSON body. If `service` is provided and is one of `surrealdb`, `restate`, `workflow-runtime`, or `api`, run only that check. Otherwise run all checks via the existing `runHealthChecks()`.
2. Persist each result with `createHealthCheck()`.
3. Prune old records with `pruneHealthChecksByAge()`.
4. Return `200` with `{ results: HealthCheckRecord[] }`.

Invalid service values return `400`.

### Refactor `src/index.ts`

Split into two clear parts:

- `startScheduler()` — the existing interval loop.
- `startServer()` — the new `Bun.serve` endpoint.

Both are started from the top-level script. Either one failing to start should not prevent the other from running.

## `apps/api` changes

### Startup trigger

After the API server starts listening, fire a non-blocking request to `health-monitor`:

```ts
fetch(`${process.env.HEALTH_MONITOR_URL}/refresh`, { method: 'POST' })
  .then(async (res) => {
    if (!res.ok) console.warn('Startup health refresh failed:', res.status)
    else console.log('Startup health refresh triggered')
  })
  .catch((err) => console.warn('Failed to reach health-monitor on startup:', err))
```

The API must start successfully even if `health-monitor` is unreachable.

### New admin endpoint

In `apps/api/src/routes/admin.ts`, add:

```ts
POST /health-checks/refresh
```

- Requires `platform:view` permission.
- Accepts optional JSON body `{ service?: string }`.
- Forwards the request to `POST $HEALTH_MONITOR_URL/refresh`.
- Returns the response from `health-monitor`.
- Returns `502` if `health-monitor` is unreachable.

## `apps/admin` changes

### New **Refresh now** button on `/health`

Next to the existing **Refresh** button, add **Refresh now**:

- While pending, show a loading state and disable the button.
- Call `POST /api/admin/health-checks/refresh`.
- On success, call the existing `refresh()` to reload the latest data.
- On error, display the error message.

## Environment variables

Add to `.env.example`:

```bash
HEALTH_MONITOR_URL=http://localhost:3010
HEALTH_MONITOR_PORT=3010
```

Update `docker-compose.yml`:

- Expose `HEALTH_MONITOR_PORT` on the `health-monitor` service.
- Add `HEALTH_MONITOR_URL` to the `api` service environment so the API can reach `http://health-monitor:3010` inside the Compose network.

## Error handling

- A failed individual service check is still persisted as `status: 'unhealthy'` with the error message (existing behavior).
- If the startup refresh request fails, the API logs a warning and continues running.
- If the admin endpoint cannot reach `health-monitor`, it returns `502` with the error message.
- If `Bun.serve` fails to start in `health-monitor`, log the error but keep the scheduler loop running.

## Testing

1. Start infrastructure and `health-monitor`.
2. Start the API server.
3. Verify the API logs show a successful startup refresh trigger.
4. Open the admin `/health` page and confirm statuses appear without waiting for the scheduler interval.
5. Click **Refresh now** and confirm new records are written.
6. Stop `health-monitor` and verify the API still starts and the admin endpoint returns `502`.
7. Send `POST /refresh { "service": "api" }` directly to `health-monitor` and verify only the `api` record updates.

## Files to create or modify

### Modified files

- `apps/health-monitor/src/index.ts` — add `Bun.serve` and split scheduler startup.
- `apps/api/src/index.ts` — add startup refresh trigger.
- `apps/api/src/routes/admin.ts` — add `POST /health-checks/refresh`.
- `apps/admin/app/pages/health.vue` — add **Refresh now** button.
- `.env.example` — add `HEALTH_MONITOR_URL` and `HEALTH_MONITOR_PORT`.
- `docker-compose.yml` — wire `HEALTH_MONITOR_PORT` and `HEALTH_MONITOR_URL`.
- `docs/50-Features/Admin Health Monitor.md` — document the refresh endpoint and startup behavior.
- `docs/30-Apps/Health Monitor/Overview.md` — document the HTTP endpoint.

## Related

- [[50-Features/Admin Health Monitor|Admin Health Monitor]]
- [[30-Apps/Health Monitor/Overview|Health Monitor App]]
- [[30-Apps/Admin App/Overview|Admin App]]
- [[2026-06-15-standalone-health-monitor-service-design|Standalone Health Monitor Service Design]]
