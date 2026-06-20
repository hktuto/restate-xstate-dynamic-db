---
title: workflow-actions package
type: package
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-19
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

## Build

`workflow-actions` is imported directly as TypeScript source. Consumers resolve `packages/workflow-actions/src/*.ts` via the package `exports` field. There is no build step.

```bash
pnpm --filter workflow-actions typecheck
```

## Tests

```bash
pnpm --filter workflow-actions test
```

## Runtime registries

- `createActionActors(objectCtx, runtime, promises?)` returns XState `invoke` actor logic for every catalog action. `runtime` is `{ designId, tableName?, companyId?, namespace?, config: { id } }`. Each actor runs inside `objectCtx.run` so side effects are durable and retried.
- `createGuardRegistry(context)` returns XState guard implementations.

## Adding an action or guard

1. Add the catalog definition in `src/catalog/`.
2. Add the runtime implementation in `src/runtime/`.
3. Register it in the catalog index.

## Related

- [[50-Features/Workflow Actions Catalog|Workflow Actions Catalog]]
- [[50-Features/Guards & Conditions|Guards & Conditions]]
- [[Workflow Runtime|Workflow Runtime architecture]]
