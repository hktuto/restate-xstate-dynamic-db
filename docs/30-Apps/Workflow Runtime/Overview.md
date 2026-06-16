---
title: Workflow Runtime Overview
type: app
status: done
area: runtime
created: 2026-06-14
updated: 2026-06-16
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

`apps/workflow-runtime` runs on [Bun](https://bun.sh/) for TypeScript-native execution. Local development uses `bun --watch src/index.ts`; type checking remains `tsc --noEmit` because Bun does not typecheck.

For a one-command local stack, start the service with Docker Compose:

```bash
docker compose up -d
pnpm restate:register
```

The container exposes port `9080` and reaches the host-based `web` API at `http://host.docker.internal:3000`.

To run the runtime on the host instead (e.g. for faster iteration), start Restate and then run:

```bash
pnpm --filter workflow-runtime dev
pnpm restate:register:host
```

## Handlers

| Handler | Kind | Purpose |
|---------|------|---------|
| `create` | exclusive | Start a new instance from a definition and optional first event. |
| `send` | exclusive | Send an event to an existing instance. |
| `subscribe` | exclusive | Register an awakeable for a wait condition. |
| `unsubscribe` | exclusive | Remove an awakeable subscription. |
| `waitFor` | shared | Block until a condition is met or a timeout occurs. |
| `snapshot` | exclusive | Return the persisted actor snapshot. |

## Ports

- Service: `9080`
- Restate ingress: `8080`
- Restate meta: `9070`

## Related

- [[Workflow Runtime]]
- [[50-Features/Workflow Engine|Workflow Engine]]
- [[40-Packages/workflow-actions|workflow-actions]]
- [[50-Features/User Tasks|User Tasks]]
