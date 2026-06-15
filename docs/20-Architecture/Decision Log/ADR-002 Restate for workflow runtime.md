---
title: ADR-002: Restate for workflow runtime
type: adr
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Workflow Runtime]]
  - [[30-Apps/Workflow Runtime/Overview]]
---

# ADR-002: Restate for workflow runtime

## Context

Workflows are long-running and must survive process restarts, retries, and failures.

## Decision

Use Restate as the durable runtime for workflow execution.

## Rationale

- Built-in durable execution: state, timers, retries, and idempotency.
- TypeScript SDK fits the monorepo stack.
- Can be self-hosted with Docker.

## Consequences

- Adds a runtime dependency.
- Requires understanding of Restate service/ingress concepts.

## Related

- [[Workflow Runtime]]
- [[30-Apps/Workflow Runtime/Overview|Workflow Runtime App]]
