---
title: Health-Driven UX Design
type: note
status: planned
area: web
app:
  - web
created: 2026-06-15
updated: 2026-06-15
related:
  - [[30-Apps/Web App/Overview]]
  - [[50-Features/Admin Health Monitor]]
  - [[20-Architecture/System Overview]]
---

# Health-Driven UX Design

## Goal

Use the platform health checks already stored by the admin health monitor to drive the web app user experience. When critical services are unhealthy, the web app shows a maintenance page. When workflow-related services are unhealthy, it shows a degradation banner while keeping the rest of the app usable.

## Scope

### In scope

- Web app `/api/platform-status` endpoint that reads the latest health checks from SurrealDB.
- Compute a platform mode from the latest checks:
  - `maintenance` — SurrealDB or web-api is unhealthy, or checks are stale/missing.
  - `degraded` — Restate or workflow-runtime is unhealthy.
  - `normal` — all checks are healthy and fresh.
- Global status state shared between server and client.
- Global degradation banner in the web app default layout.
- Hard maintenance mode that redirects non-API routes to `/maintenance`.
- A `/maintenance` page.

### Out of scope

- Workflow-runtime self-registration check (deferred to a future auto-environment check solution).
- Per-feature toggles beyond the global banner/maintenance page.
- Alerting or notifications.

## Architecture

```text
┌─────────────────┐     reads latest      ┌─────────────────┐
│  Web app        │ ────────────────────> │  health_checks  │
│  (Nuxt/Nitro)   │                       │  (platform/admin)│
└─────────────────┘                       └─────────────────┘
         │
         │ exposes
         ▼
┌─────────────────┐
│ /api/platform-status
│ { mode, checks, checkedAt }
└─────────────────┘
         │
         │ consumed by
         ▼
┌─────────────────┐     ┌─────────────────┐
│  layout banner  │     │  route middleware│
│  (degraded)     │     │  (maintenance)   │
└─────────────────┘     └─────────────────┘
```

## Platform status rules

The `/api/platform-status` endpoint calls `listLatestHealthChecks()` from the `db` package and applies these rules:

1. If no checks exist, or the newest `checkedAt` is older than the staleness threshold, return `maintenance` with message `Health checks are stale or unavailable`.
2. If SurrealDB or web-api is `unhealthy`, return `maintenance`.
3. Else if Restate or workflow-runtime is `unhealthy`, return `degraded`.
4. Else return `normal`.

The staleness threshold is configurable via `PLATFORM_STATUS_STALENESS_MS` and defaults to `300000` (5 minutes).

## API

### `GET /api/platform-status`

Public endpoint. Returns:

```ts
interface PlatformStatus {
  mode: 'normal' | 'degraded' | 'maintenance'
  message?: string
  checks: HealthCheckRecord[]
  checkedAt?: string
}
```

## UI behaviour

### Degraded mode

- The default layout shows a non-dismissible banner at the top:
  - Text: "Some features are temporarily unavailable. We're working on it."
  - Optional: list the unhealthy services (e.g., "Restate", "workflow-runtime").
- Other pages remain accessible.

### Maintenance mode

- All non-API, non-asset routes redirect to `/maintenance`.
- The maintenance page shows a simple message: "Platform maintenance in progress. Please try again later."
- Server-side requests return HTTP `503` for non-API routes when possible.

### Normal mode

- No banner, no redirects.

## Global state

- Server middleware `apps/web/server/middleware/platform-status.ts`:
  - Computes the platform status on each request.
  - Sets `event.context.platformStatus`.
- Client plugin `apps/web/app/plugins/platform-status.client.ts`:
  - Fetches `/api/platform-status` on app boot.
  - Stores the result in `useState('platformStatus')`.
- Composable `apps/web/app/composables/usePlatformStatus.ts`:
  - Returns the current status from `useState('platformStatus')`.
  - Falls back to `event.context.platformStatus` on the server.

## Middleware

### Client route middleware

`apps/web/app/middleware/platform-status.global.ts`:

- Skips `/maintenance` and `/api/*`.
- If `mode === 'maintenance'`, redirect to `/maintenance`.

### Server middleware

`apps/web/server/middleware/platform-status.ts`:

- Computes platform status at the start of each request.
- Skips API routes and static assets.
- If `mode === 'maintenance'`, sends `503` and renders the maintenance page or redirects.

## Configuration

Add to `.env.example`:

```bash
# Web app platform status
PLATFORM_STATUS_STALENESS_MS=300000
```

Existing health monitor env vars are reused (`RESTATE_META_URL`, `WORKFLOW_RUNTIME_URL`, `WEB_API_URL`, `HEALTH_CHECK_INTERVAL_MS`, `HEALTH_CHECK_HISTORY_LIMIT`).

## Files to create or modify

### New files

- `apps/web/server/api/platform-status.get.ts`
- `apps/web/server/middleware/platform-status.ts`
- `apps/web/app/plugins/platform-status.client.ts`
- `apps/web/app/composables/usePlatformStatus.ts`
- `apps/web/app/middleware/platform-status.global.ts`
- `apps/web/app/pages/maintenance.vue`

### Modified files

- `apps/web/app/layouts/default.vue` — add degradation banner above `<slot />`.
- `.env.example` — add `PLATFORM_STATUS_STALENESS_MS`.
- `docs/30-Apps/Web App/Overview.md` — mention platform status behaviour.
- `docs/50-Features/Admin Health Monitor.md` — mention that health checks also drive web app UX.

## Error handling

- If reading from SurrealDB fails, the endpoint returns `maintenance` so the web app fails closed.
- Middleware and plugins catch errors and default to `maintenance`.
- The client plugin silently fails on network errors; the app continues without a status (banner hidden).

## Testing

- Unit test the status computation logic with mocked health records.
- Manual test: stop SurrealDB → verify redirect to `/maintenance`.
- Manual test: stop workflow-runtime → verify degradation banner on web pages.
- Manual test: restore services → verify banner disappears and maintenance redirect is removed.

## Future extensions

- Per-feature flags (e.g., `workflowsEnabled`, `ingressEnabled`) derived from the same health data.
- Workflow-runtime self-registration check, once an auto-environment check solution is in place.
- Admin app could also consume `usePlatformStatus()` to show a tenant-facing preview.

## Related

- [[30-Apps/Web App/Overview|Web App]]
- [[50-Features/Admin Health Monitor|Admin Health Monitor]]
- [[20-Architecture/System Overview|System Overview]]
