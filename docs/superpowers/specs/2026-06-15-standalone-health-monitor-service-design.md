---
title: Standalone Health Monitor Service Design
type: note
status: in-progress
area: docs
created: 2026-06-15
updated: 2026-06-16
related:
  - [[50-Features/Admin Health Monitor]]
  - [[30-Apps/Admin App/Overview]]
  - [[20-Architecture/System Overview]]
  - [[40-Packages/db]]
---

# Standalone Health Monitor Service Design

## Goal

Move the health check runner out of the admin app and into a dedicated, thin TypeScript service powered by Bun. This removes the need for a build step, makes the admin app stateless and safe to scale behind a load balancer, and keeps a single source of truth for periodic health checks.

## Scope

### In scope

- Create `apps/health-monitor` as a new workspace package.
- Move `apps/admin/server/utils/health-monitor.ts` to `apps/health-monitor/src/runner.ts`.
- Create `apps/health-monitor/src/index.ts` with the scheduler loop and graceful shutdown.
- Delete the admin in-process scheduler plugin, config util, and runner.
- Remove the manual "Run checks now" trigger from the admin UI/API (checks are now driven solely by the standalone service).
- Add a `dev` script so the service can be run locally with `pnpm --filter health-monitor dev`.

### Out of scope

- Adding an HTTP API to the service (it is a background worker only).
- Production Docker image / Kubernetes manifests (the spec leaves room for them, but they are not part of this change).
- Changing the web app's platform-status behavior.
- Auto-registration checks for workflow-runtime in Restate (deferred to a future auto-environment check solution).

## Architecture

```text
┌─────────────────────┐     setInterval      ┌─────────────────────────────┐
│  health-monitor     │ ───────────────────> │  Runner                     │
│  (Node/TypeScript)  │                      │  (src/runner.ts)            │
└─────────────────────┘                      └─────────────────────────────┘
         │                                                │
         │ writes                                         │ checks
         ▼                                                ▼
┌─────────────────────┐                          ┌─────────────────┐
│  health_checks      │                          │  SurrealDB      │
│  (platform/admin)   │                          │  Restate        │
└─────────────────────┘                          │  workflow-runtime│
                                                 │  web API        │
                                                 └─────────────────┘

┌─────────────────────┐
│  Admin app          │
│  reads latest +     │
│  history from DB    │
└─────────────────────┘
```

## Service structure

### `apps/health-monitor/package.json`

Workspace package with:

- `name`: `health-monitor`
- `type`: `module`
- scripts:
  - `dev`: `bun src/index.ts`
  - `start`: `bun src/index.ts`
- dependencies:
  - `db`: `workspace:*`
- devDependencies:
  - `typescript`
  - `bun-types`

### `apps/health-monitor/src/runner.ts`

Moved from `apps/admin/server/utils/health-monitor.ts` with minimal changes:

- Keep `runHealthChecks()`, `checkSurrealDB()`, `checkRestate()`, `checkWorkflowRuntime()`, `checkWebApi()`.
- Keep the 5000ms timeout helper.
- Keep the Restate registration check that looks for the `workflow` service.
- No Nuxt/Nitro imports.

### `apps/health-monitor/src/index.ts`

Scheduler loop:

1. Parse `HEALTH_CHECK_INTERVAL_MS` (default 60s; `0` disables the loop).
2. Parse `HEALTH_CHECK_HISTORY_LIMIT` (default 100).
3. On each tick:
   - Skip if a previous tick is still running.
   - Call `runHealthChecks()`.
   - For each result:
     - `createHealthCheck({ service, status, checkedAt, responseTimeMs, message, details })`
     - `pruneHealthChecks(service, HISTORY_LIMIT)`
   - Log completion or errors.
4. Register `SIGTERM`/`SIGINT` handlers to clear the interval and exit cleanly.

## Admin app changes

### Delete

- `apps/admin/server/plugins/health-monitor-scheduler.ts`
- `apps/admin/server/utils/health-monitor.ts`
- `apps/admin/server/utils/health-check-config.ts`

### Keep unchanged

- `apps/admin/server/api/health-checks/index.get.ts`
- `apps/admin/server/api/health-checks/history.get.ts`
- `apps/admin/server/api/health-checks/run.post.ts`
- `apps/admin/app/pages/health.vue`

The admin app remains the UI and API for health data, but it no longer runs checks itself.

## Runtime

The service uses Bun as its runtime. Bun executes TypeScript directly, so no build step is required. The trade-off is that every environment running the service needs Bun installed.

On Windows, Bun support is still maturing; if it proves unreliable, the same source files can be run under Node with `tsx` as a fallback.

## Configuration

The service reuses existing environment variables already documented in `.env.example`:

```bash
SURREAL_URL=http://127.0.0.1:8000/rpc
SURREAL_USER=root
SURREAL_PASS=root

RESTATE_META_URL=http://localhost:9070
WORKFLOW_RUNTIME_URL=http://localhost:9080
WEB_API_URL=http://localhost:3000

HEALTH_CHECK_INTERVAL_MS=60000
HEALTH_CHECK_HISTORY_LIMIT=100
```

No new env vars are required.

## Local development

Bun must be installed on the developer machine:

```bash
curl -fsSL https://bun.sh/install | bash
```

Start infrastructure:

```bash
docker compose up -d
```

Run the service on the host:

```bash
pnpm --filter health-monitor dev
```

Run admin and web apps as usual:

```bash
pnpm --filter admin dev
pnpm --filter web dev
```

## Docker Compose (optional future step)

A `health-monitor` service can be added to `docker-compose.yml` once the workflow-runtime and web API are also containerized or reachable via Docker networking. Until then, running on the host is the simplest path.

## Files to create or modify

### New files

- `apps/health-monitor/package.json`
- `apps/health-monitor/tsconfig.json`
- `apps/health-monitor/src/runner.ts`
- `apps/health-monitor/src/index.ts`

### Modified files

- `apps/admin/app/pages/health.vue` — remove the manual "Run checks now" button and related state.
- `apps/admin/package.json` — remove the scheduler plugin file reference if needed; no dependency changes.
- `docs/50-Features/Admin Health Monitor.md` — update to say checks run in a standalone service.
- `docs/30-Apps/Admin App/Overview.md` — remove the scheduler reference if present.
- `docs/60-Development/Getting Started.md` — add `pnpm --filter health-monitor dev` to the startup commands.

### Deleted files

- `apps/admin/server/plugins/health-monitor-scheduler.ts`
- `apps/admin/server/utils/health-monitor.ts`
- `apps/admin/server/utils/health-check-config.ts`
- `apps/admin/server/api/health-checks/run.post.ts`

## Error handling

- A failed check is stored as `status: 'unhealthy'` with the error message.
- Network timeouts are capped at 5000ms so one slow service does not block the whole tick.
- Persistence errors are logged per service and do not crash the service.
- Scheduler errors are caught and logged; they do not stop the interval.

## Testing

- Run the service: `pnpm --filter health-monitor dev`
- Verify Bun can execute the runner and connect to SurrealDB (smoke test the first tick).
- Stop one target service (e.g., workflow-runtime) and confirm the next tick records it as unhealthy.
- Verify the admin app still builds and displays history after the scheduler plugin is removed.

If Bun compatibility issues appear with the `db` package or `surrealdb` SDK, fall back to the Node + `tsx` runtime.

## Related

- [[50-Features/Admin Health Monitor|Admin Health Monitor]]
- [[30-Apps/Admin App/Overview|Admin App]]
- [[20-Architecture/System Overview|System Overview]]
- [[40-Packages/db|db package]]
