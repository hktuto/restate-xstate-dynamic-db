---
title: Workflow Runtime Overview
type: app
status: done
area: runtime
created: 2026-06-14
updated: 2026-06-14
app:
  - runtime
related:
  - [[Workflow Runtime]]
  - [[50-Features/Workflow Engine]]
  - [[40-Packages/workflow-actions]]
---

# Workflow Runtime Overview

## Purpose

The Restate service that executes workflow definitions durably.

## Key behaviors

- Loads workflow definitions from SurrealDB tenant namespaces.
- Starts workflow instances from triggers.
- Executes XState actions and evaluates guards.
- Relies on Restate for persistence, retries, and timers.

## Ports

- Service: `9080`
- Restate ingress: `8080`
- Restate meta: `9070`

## Related

- [[Workflow Runtime]]
- [[50-Features/Workflow Engine|Workflow Engine]]
- [[40-Packages/workflow-actions|workflow-actions]]
