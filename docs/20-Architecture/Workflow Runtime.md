---
title: Workflow Runtime
type: note
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-15
related:
  - [[30-Apps/Workflow Runtime/Overview]]
  - [[50-Features/Workflow Engine]]
  - [[40-Packages/workflow-actions]]
  - [[50-Features/User Tasks]]
---

# Workflow Runtime

## Runtime architecture

Workflow definitions authored in the visual editor are executed by the Restate service in `apps/workflow-runtime`. The service exposes a single Restate Virtual Object named `workflow`, keyed by instance ID. Each instance stores a persisted XState actor snapshot plus runtime context.

## Responsibilities

- Compile workflow definitions into XState machines at runtime.
- Create workflow instances from trigger events.
- Send events to existing instances and run transitions.
- Evaluate guards and execute actions from `packages/workflow-actions`.
- Persist actor snapshots and context via Restate Virtual Object state.
- Update instance status in SurrealDB (`workflow_instances`).
- Create `user_tasks` when a state is tagged `waiting`.
- Resolve `waitFor` subscriptions via Restate awakeables.
- Handle retries, timers, and idempotency via Restate.

## Integration points

- Receives triggers from web/admin apps via Restate ingress.
- Reads/writes tenant and platform data via `packages/db`.
- Loads action and guard registries from `packages/workflow-actions`.
- Calls Nitro API endpoints to update instance status and create user tasks.

## Why not `@restatedev/xstate`

The official `@restatedev/xstate` package requires machines to be registered statically at service startup. This project compiles workflow definitions dynamically from SurrealDB, so the lower-level `restate.object` API is used instead.

## Related

- [[30-Apps/Workflow Runtime/Overview|Workflow Runtime App]]
- [[50-Features/Workflow Engine|Workflow Engine]]
- [[40-Packages/workflow-actions|workflow-actions package]]
- [[50-Features/User Tasks|User Tasks]]
