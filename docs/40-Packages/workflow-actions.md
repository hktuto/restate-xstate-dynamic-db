---
title: workflow-actions package
type: package
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-15
package: workflow-actions
related:
  - [[50-Features/Workflow Actions Catalog]]
  - [[50-Features/Guards & Conditions]]
  - [[Workflow Runtime]]
---

# workflow-actions package

## Purpose

Catalog of reusable workflow actions and guards, plus runtime execution helpers.

## Location

`packages/workflow-actions`

## Structure

- `src/catalog/` — definitions of available actions and guards.
- `src/runtime/` — runtime execution logic.

## Runtime registries

- `createActionRegistry(ctx, context)` returns XState action implementations plus a list of async promises to await before snapshotting. Actions receive the Restate `ObjectContext` so side effects are durable and retried.
- `createGuardRegistry(context)` returns XState guard implementations. Guards receive the current context, event, and configured params.

## Adding an action or guard

1. Add the catalog definition in `src/catalog/`.
2. Add the runtime implementation in `src/runtime/`.
3. Register it in the catalog index.

## Related

- [[50-Features/Workflow Actions Catalog|Workflow Actions Catalog]]
- [[50-Features/Guards & Conditions|Guards & Conditions]]
- [[Workflow Runtime|Workflow Runtime architecture]]
