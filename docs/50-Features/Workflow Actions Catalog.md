---
title: Workflow Actions Catalog
type: feature
status: planned
area: workflow
created: 2026-06-14
updated: 2026-06-15
app:
  - web
  - admin
  - runtime
related:
  - [[40-Packages/workflow-actions]]
  - [[50-Features/Workflow Engine]]
---

# Workflow Actions Catalog

## Overview

A registry of actions that can be attached to workflow states and transitions. Catalog entries describe metadata for the visual editor, while runtime handlers execute inside the Restate Virtual Object.

## Catalog structure

Actions are defined in `packages/workflow-actions/src/catalog/` and implemented in `packages/workflow-actions/src/runtime/`.

## Runtime integration

`createActionRegistry` builds a map of XState action implementations. Each action receives the current `ObjectContext` so it can call `ctx.run` for durable side effects. The registry also collects any async promises created during action execution so the runtime can await them before taking a snapshot.

Entry parameters from the workflow definition are passed through the action's `params` property.

## Adding a new action

1. Define metadata in `src/catalog/<action-name>.ts`.
2. Implement the handler in `src/runtime/<action-name>.ts`.
3. Register it in the catalog index.

## Related

- [[40-Packages/workflow-actions|workflow-actions package]]
- [[50-Features/Workflow Engine|Workflow Engine]]
