---
title: Workflow Engine
type: feature
status: planned
area: workflow
created: 2026-06-14
updated: 2026-06-15
app:
  - runtime
related:
  - [[Workflow Runtime]]
  - [[30-Apps/Workflow Runtime/Overview]]
  - [[50-Features/Workflow Actions Catalog]]
  - [[50-Features/Guards & Conditions]]
  - [[50-Features/User Tasks]]
---

# Workflow Engine

## Overview

Executes XState workflows durably using Restate. Workflow definitions are compiled into XState machines at runtime so they can be authored dynamically in the visual editor.

## Responsibilities

- Compile workflow definitions into XState machines at runtime.
- Create workflow instances from triggers.
- Send events to existing instances.
- Evaluate guards and execute actions from `workflow-actions`.
- Persist actor snapshots via Restate's Virtual Object state.
- Update instance status in SurrealDB.
- Create user tasks when a workflow enters a `waiting` state.
- Resolve subscriptions and awakeables for `waitFor` calls.

## Runtime handlers

The Restate Virtual Object `workflow` exposes:

- `create` — start a new instance from a definition and optional first event.
- `send` — send an event to an existing instance.
- `subscribe` — register an awakeable for a condition.
- `unsubscribe` — remove an awakeable subscription.
- `waitFor` (shared) — block until a condition is met or a timeout occurs.
- `snapshot` — return the persisted actor snapshot.

## Instance lifecycle statuses

- `pending`
- `running`
- `waiting`
- `done`
- `error`

## Related

- [[Workflow Runtime]]
- [[30-Apps/Workflow Runtime/Overview|Workflow Runtime App]]
- [[50-Features/Workflow Actions Catalog|Workflow Actions Catalog]]
- [[50-Features/Guards & Conditions|Guards & Conditions]]
- [[50-Features/User Tasks|User Tasks]]
