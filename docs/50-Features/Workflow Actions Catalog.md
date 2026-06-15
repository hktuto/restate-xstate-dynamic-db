---
title: Workflow Actions Catalog
type: feature
status: planned
area: workflow
created: 2026-06-14
updated: 2026-06-14
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

A registry of actions that can be attached to workflow states and transitions.

## Catalog structure

Actions are defined in `packages/workflow-actions/src/catalog/` and implemented in `packages/workflow-actions/src/runtime/`.

## Adding a new action

1. Define metadata in `src/catalog/<action-name>.ts`.
2. Implement the handler in `src/runtime/<action-name>.ts`.
3. Export from the package index.

## Related

- [[40-Packages/workflow-actions|workflow-actions package]]
- [[50-Features/Workflow Engine|Workflow Engine]]
