---
title: Workflow Runtime Overview
type: app
status: done
area: runtime
created: 2026-06-14
updated: 2026-06-19
app:
  - runtime
related:
  - [[Workflow Runtime]]
  - [[50-Features/Workflow Engine]]
  - [[40-Packages/workflow-actions]]
  - [[50-Features/User Tasks]]
---

# Workflow Runtime Overview

## Purpose

The Restate service that executes workflow definitions durably.

## Key behaviors

- Compiles workflow definitions into XState machines at runtime.
- Exposes a Restate Virtual Object named `workflow` keyed by instance ID.
- Creates instances from triggers via the `create` handler.
- Sends events to existing instances via the `send` handler.
- Executes XState actions and evaluates guards from `workflow-actions`.
- Persists actor snapshots via Restate Virtual Object state.
- Creates user tasks when a state is tagged `waiting`.
- Supports blocking `waitFor` calls with conditions and optional timeouts.
- Relies on Restate for persistence, retries, timers, and idempotency.

## Runtime

`apps/workflow-runtime` runs on [Bun](https://bun.sh/) for TypeScript-native execution inside Docker. Type checking remains `tsc --noEmit` because Bun does not typecheck.

For a one-command local stack, start the service with Docker Compose:

```bash
docker compose up -d
```

The `restate-register` service automatically registers the workflow runtime with Restate over HTTP/2. The container exposes port `9080` for Restate traffic and port `9081` for the HTTP/1.1 health endpoint. It reaches the host-based `web` API at `http://host.docker.internal:3000`.

## Handlers

| Handler | Kind | Purpose |
|---------|------|---------|
| `create` | exclusive | Start a new instance from a definition and optional first event. |
| `send` | exclusive | Send an event to an existing instance. |
| `subscribe` | exclusive | Register an awakeable for a wait condition. |
| `unsubscribe` | exclusive | Remove an awakeable subscription. |
| `waitFor` | shared | Block until a condition is met or a timeout occurs. |
| `snapshot` | exclusive | Return the persisted actor snapshot. |

## Protocol and ports

- **Restate endpoint:** `9080` over **HTTP/2** (`restate.serve()`).
- **Health endpoint:** `9081` over HTTP/1.1 (`/health`), used by Docker Compose health checks.
- **Restate ingress:** `8080`
- **Restate meta:** `9070`

The health endpoint is intentionally separate from the Restate endpoint so Compose can verify liveness without interfering with HTTP/2 traffic.

## Tests

```bash
# Requires surrealdb-test on port 8001
docker compose up -d surrealdb-test
pnpm --filter workflow-runtime test
```

The workflow-runtime test suite extends the shared `vitest.base.config.ts`, which loads `.env.test` and points `SURREAL_URL` at the test SurrealDB instance.

## Related

- [[Workflow Runtime]]
- [[50-Features/Workflow Engine|Workflow Engine]]
- [[40-Packages/workflow-actions|workflow-actions]]
- [[50-Features/User Tasks|User Tasks]]
