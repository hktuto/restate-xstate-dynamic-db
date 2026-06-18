---
title: Real CRUD Workflow Actions — Logic & Runtime Integration Plan
type: note
status: in-progress
area: docs
created: 2026-06-17
updated: 2026-06-17
---

# Real CRUD Workflow Actions — Logic & Runtime Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the POC workflow actions with real CRUD building blocks (`getRecord`, `createRecord`, `updateRecord`, `deleteRecord`) plus a `condition` action/guard, wired through XState `invoke` so action states can emit `ok`/`error`/`true`/`false` result events, and verify the runtime end-to-end.

**Architecture:** Each workflow state that has `meta.action` is compiled into an XState state with an `invoke` actor. The actor runs the action inside `objectCtx.run`, then raises a result event. Success results are assigned to `context[<outputKey>]`, failures to `context.lastError`. A shared MongoDB-style expression evaluator powers both the `condition` action and a generic `condition` guard.

**Tech Stack:** TypeScript, XState 5, Restate SDK, SurrealDB, Vitest.

**Scope note:** Editor UI tasks (`ActionConfigPanel.vue`, `StateNode.vue`, finishing `DetailsPanel.vue`) are out of scope for this plan. They will be covered by a separate frontend-integration plan after the runtime logic is proven.

---

## Baseline & warnings

Before touching code, run the baseline verification. The repo has **pre-existing** `nuxt typecheck` failures in `layers/workflow-editor`, `apps/web/pages/workflows/[id].vue`, `apps/admin/pages/workflows/[id].vue`, `server/utils/platform-status.ts`, and strict-null returns in `packages/db`. Do **not** try to fix them in this plan. Production build should still pass.

```bash
pnpm install
pnpm -r build
```

Expected: `pnpm -r build` exits `0`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/workflow-actions/src/types.ts` | Executor context types; add `context` to action/guard contexts. |
| `packages/workflow-actions/src/runtime/expression.ts` | MongoDB-style expression evaluator. |
| `packages/workflow-actions/src/runtime/query-builder.ts` | Convert a MongoDB-style filter into a parameterized SurrealQL `SELECT` query. |
| `packages/workflow-actions/src/runtime/actions.ts` | CRUD + `condition` runtime handlers. |
| `packages/workflow-actions/src/runtime/guards.ts` | Generic `condition` guard using the expression evaluator. |
| `packages/workflow-actions/src/runtime/index.ts` | Build XState `invoke` actors from runtime actions and a guard registry. |
| `packages/workflow-actions/src/catalog/actions.ts` | Metadata for CRUD + `condition` actions. |
| `packages/workflow-actions/src/catalog/guards.ts` | Metadata for the `condition` guard. |
| `packages/db/package.json` | Add `./normalize` export so `workflow-actions` can reuse `normalizeId`. |
| `packages/db/src/seed-workflows.ts` | Update the seeded `provisionCompany` workflow to use `updateRecord`. |
| `apps/workflow-runtime/src/compile.ts` | Compile `state.meta.action` into XState `invoke`, `raise`, and `assign`. |
| `apps/workflow-runtime/src/workflow.ts` | Use live snapshot for runtime checks and persisted snapshot for save. |
| `apps/workflow-runtime/src/snapshot.ts` | Provide live/persisted snapshot helpers. |
| `apps/workflow-runtime/tests/compile.test.ts` | Compile-time behavior tests. |
| `apps/workflow-runtime/tests/runtime.test.ts` | Restate integration tests for condition actions. |
| `docs/50-Features/Workflow Actions Catalog.md` | Document new actions. |
| `docs/50-Features/Guards & Conditions.md` | Document the `condition` guard. |
| `docs/40-Packages/workflow-actions.md` | Update registry description. |

---

## Task 1: Update executor context types

**Files:**
- Modify: `packages/workflow-actions/src/types.ts`
- Test: `packages/workflow-actions/tests/types.test.ts`

- [x] Add `context: Record<string, unknown>` to `ActionExecutorContext` and `GuardExecutorContext`.
- [x] Change `ActionExecutor` return type to `Promise<unknown> | unknown`.
- [x] Add `packages/workflow-actions/tests/types.test.ts`.
- [x] Run `pnpm --filter workflow-actions typecheck`.
- [x] Commit.

---

## Task 2: Implement the expression evaluator

**Files:**
- Create: `packages/workflow-actions/src/runtime/expression.ts`
- Test: `packages/workflow-actions/tests/expression.test.ts`

- [x] Implement `resolveValue` with `$context.` ref resolution.
- [x] Implement `evaluateExpression` supporting `$eq`, `$ne`, `$exists`, `$in`, `$nin`, `$and`, `$or`, `$not`.
- [x] Add tests.
- [x] Run `pnpm test packages/workflow-actions/tests/expression.test.ts`.
- [x] Commit.

---

## Task 3: Implement the SurrealQL query builder

**Files:**
- Create: `packages/workflow-actions/src/runtime/query-builder.ts`
- Test: `packages/workflow-actions/tests/query-builder.test.ts`

- [x] Implement `buildSelectQuery` with `$eq`, `$ne`, `$exists`, `$in`, `$nin`, `$and`, `$or`, `$not`.
- [x] Support `resultType: 'first' | 'list'`.
- [x] Validate field identifiers and `$and`/`$or` array shapes.
- [x] Add tests.
- [x] Commit.

---

## Task 4: Add `db/normalize` export

**Files:**
- Modify: `packages/db/package.json`

- [x] Add `./normalize` export.
- [x] Run `pnpm --filter db typecheck`.
- [x] Commit.

---

## Task 5: Implement CRUD runtime actions

**Files:**
- Modify: `packages/workflow-actions/src/runtime/actions.ts`
- Test: `packages/workflow-actions/tests/actions.test.ts`

- [x] Implement `getRecord`, `createRecord`, `updateRecord`, `deleteRecord`, `condition`.
- [x] Handle defaults (id, soft delete).
- [x] Add happy-path and error-path tests.
- [x] Commit.

---

## Task 6: Implement the `condition` guard

**Files:**
- Modify: `packages/workflow-actions/src/runtime/guards.ts`
- Test: `packages/workflow-actions/tests/guards.test.ts`

- [x] Replace POC guards with `condition` guard.
- [x] Add test.
- [x] Commit.

---

## Task 7: Build XState invoke actors and guard registry

**Files:**
- Modify: `packages/workflow-actions/src/runtime/index.ts`
- Test: `packages/workflow-actions/tests/registry.test.ts`

- [x] Replace `createActionRegistry` with `createActionActors` returning `fromPromise` actors.
- [x] Collect `objectCtx.run` promises for workflow awaiting.
- [x] Actor output shape: `{ data, outputKey }`.
- [x] Update `createGuardRegistry` to use XState-provided params.
- [x] Add `xstate` dependency and update lockfile.
- [x] Add tests.
- [x] Commit.

---

## Task 8: Update action & guard catalogs

**Files:**
- Modify: `packages/workflow-actions/src/catalog/actions.ts`
- Modify: `packages/workflow-actions/src/catalog/guards.ts`

- [x] Replace POC metadata with CRUD + `condition` action metadata.
- [x] Replace POC metadata with `condition` guard metadata.
- [x] Clarify descriptions and optionality.
- [x] Commit.

---

## Task 9: Refactor `compile.ts` for invoke-based action states

**Files:**
- Modify: `apps/workflow-runtime/src/compile.ts`
- Test: `apps/workflow-runtime/tests/compile.test.ts`

- [x] Use `createActionActors` and `createGuardRegistry`.
- [x] Build `invoke` config for `state.meta.action` states.
- [x] `assignOutput` writes to `context[outputKey]`.
- [x] `assignError` writes to `context.lastError`.
- [x] Raise `ok`/`error` for CRUD and `true`/`false` for `condition`.
- [x] Return `{ machine, promises }`.
- [x] Add condition true/false and action-error tests.
- [x] Commit.

---

## Task 10: Snapshot awaiting in `workflow.ts`

**Files:**
- Modify: `apps/workflow-runtime/src/workflow.ts`
- Modify: `apps/workflow-runtime/src/snapshot.ts`

- [x] Await `promises` from `compileWorkflow` before snapshotting.
- [x] Yield one event-loop tick after `await Promise.all(promises)` so XState can process raised result events.
- [x] Use live `actor.getSnapshot()` for runtime checks (`hasTag`).
- [x] Use `actor.getPersistedSnapshot()` for persistence.
- [x] Commit.

---

## Task 11: Update the seeded workflow

**Files:**
- Modify: `packages/db/src/seed-workflows.ts`

- [x] Replace POC `provisionCompanyNamespace` with `updateRecord` action state.
- [x] Run `pnpm --filter db typecheck`.
- [x] Commit.

---

## Task 12: Runtime integration test for condition actions

**Files:**
- Modify: `apps/workflow-runtime/tests/runtime.test.ts`

- [x] Add Restate integration tests that:
  - Create a workflow with a `condition` action state.
  - Send an event that triggers the condition.
  - Assert the workflow ends in the correct branch based on `context.record.status`.
- [x] Add SurrealDB-backed end-to-end tests for `createRecord`, `getRecord` + `updateRecord`, and `deleteRecord`.
- [x] Run `pnpm --filter workflow-runtime test`.
- [x] Commit.

---

## Task 13: Final verification

- [x] Run targeted tests (`packages/workflow-actions`, `apps/workflow-runtime/tests/compile.test.ts`).
- [x] Run `pnpm --filter workflow-runtime test` (Restate integration tests).
- [x] Run `pnpm -r build`.
- [x] Run package typechecks:
  - `pnpm --filter workflow-actions typecheck`
  - `pnpm --filter workflow-runtime build`
  - `pnpm --filter db typecheck`

---

## Documentation (after runtime proven)

- [x] Update `docs/50-Features/Workflow Actions Catalog.md`.
- [x] Update `docs/50-Features/Guards & Conditions.md`.
- [x] Update `docs/40-Packages/workflow-actions.md`.
- [x] Commit docs.

---

## Out of scope (frontend integration plan)

The following editor tasks are intentionally excluded from this plan and will be handled separately:

- `layers/workflow-editor/components/ActionConfigPanel.vue` (already created, needs polish)
- `layers/workflow-editor/components/DetailsPanel.vue` (needs guard-expression JSON fix and final wiring)
- `layers/workflow-editor/components/StateNode.vue` (action badge display)

---

## Execution handoff

**Plan updated and saved to `docs/superpowers/plans/2026-06-16-real-crud-workflow-actions.md`.**

Remaining logic tasks: **Task 12** (runtime integration test) and **Task 13** (final verification), then documentation.

Ready to continue with Task 12?
