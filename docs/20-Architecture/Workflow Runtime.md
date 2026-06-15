---
title: Workflow Runtime
type: note
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
related:
  - [[30-Apps/Workflow Runtime/Overview]]
  - [[50-Features/Workflow Engine]]
  - [[40-Packages/workflow-actions]]
---

# Workflow Runtime

## Runtime architecture

Workflow definitions authored in the visual editor are executed by the Restate service in `apps/workflow-runtime`.

## Responsibilities

- Load workflow definitions from SurrealDB.
- Start workflow instances from triggers.
- Evaluate guards and execute actions.
- Handle retries, timers, and persistence via Restate.
- Report execution status back to SurrealDB.

## Integration points

- Receives triggers from web app/admin app via Restate ingress.
- Reads/writes tenant data via `packages/db`.
- Loads actions and guards from `packages/workflow-actions`.

## Related

- [[30-Apps/Workflow Runtime/Overview|Workflow Runtime App]]
- [[50-Features/Workflow Engine|Workflow Engine]]
- [[40-Packages/workflow-actions|workflow-actions package]]
