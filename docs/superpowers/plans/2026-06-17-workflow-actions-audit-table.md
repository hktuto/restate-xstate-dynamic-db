---
title: Workflow Actions Audit Table Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-17
updated: 2026-06-17
---

# Workflow Actions Audit Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `workflow_actions` table that records every action-state execution: input context on entry, and result/output context on exit, so the UI can show current action state and a per-instance audit trail.

**Architecture:** Each XState invoke actor writes one `workflow_actions` row inside the same `objectCtx.run` that executes the action. The row is upserted with a deterministic key (`instanceId:stateId`), so Restate retries do not create duplicates for simple (non-looping) workflows. The runtime context gains `instanceId` so the actor knows which instance it belongs to.

**Tech Stack:** TypeScript, SurrealDB, Restate SDK, XState, Vitest.

---

## Baseline

Before starting, ensure the previous CRUD logic work is stable:

```bash
pnpm --filter workflow-runtime test
pnpm -r build
```

Expected: workflow-runtime tests pass and production build exits `0`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `apps/workflow-runtime/src/types.ts` | Add `instanceId` to `RuntimeContext`. |
| `apps/workflow-runtime/src/workflow.ts` | Set `instanceId: ctx.key` when building `RuntimeContext`. |
| `apps/workflow-runtime/src/compile.ts` | Pass `instanceId` and `stateId` into the action actor `input`. |
| `packages/workflow-actions/src/types.ts` | Add `instanceId` to `ActionExecutorContext`. |
| `packages/workflow-actions/src/runtime/index.ts` | Write `workflow_actions` rows inside the action actor. |
| `packages/db/src/seed.ts` | Define `workflow_actions` table in platform namespace. |
| `packages/db/src/provision.ts` | Define `workflow_actions` table in tenant namespaces. |
| `packages/db/src/workflow-actions.ts` | Types and SurrealDB helpers for `workflow_actions`. |
| `packages/db/package.json` | Add `./workflow-actions` export. |
| `apps/workflow-runtime/tests/runtime.test.ts` | Integration test verifying audit rows. |
| `docs/20-Architecture/Data Model.md` | Document the new table. |
| `docs/50-Features/Workflow Engine.md` | Document action audit behavior. |
| `docs/40-Packages/db.md` | Mention the new export. |

---

## Task 1: Add `instanceId` to runtime and executor contexts

**Files:**
- Modify: `apps/workflow-runtime/src/types.ts`
- Modify: `packages/workflow-actions/src/types.ts`
- Test: `pnpm --filter workflow-actions typecheck` and `pnpm --filter workflow-runtime build`

- [ ] **Step 1: Update `RuntimeContext`**

Edit `apps/workflow-runtime/src/types.ts`:

```ts
export interface RuntimeContext {
  instanceId: string
  record: Record<string, unknown>
  tableName: string
  companyId?: string
  namespace?: string
}
```

- [ ] **Step 2: Update `ActionExecutorContext`**

Edit `packages/workflow-actions/src/types.ts`:

```ts
export interface ActionExecutorContext {
  event: any
  context: Record<string, unknown>
  record: Record<string, unknown>
  tableName: string
  companyId?: string
  namespace?: string
  instanceId: string
  params?: Record<string, unknown>
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter workflow-actions typecheck
```

Expected: passes (other files will fail until Task 2).

- [ ] **Step 4: Commit**

```bash
git add apps/workflow-runtime/src/types.ts packages/workflow-actions/src/types.ts
git commit -m "feat(workflow): add instanceId to runtime and executor contexts"
```

---

## Task 2: Thread `instanceId` and `stateId` through compile

**Files:**
- Modify: `apps/workflow-runtime/src/compile.ts`
- Modify: `apps/workflow-runtime/src/workflow.ts`
- Test: `pnpm --filter workflow-runtime build`

- [ ] **Step 1: Update `ActionActorInput` and pass values**

Edit `apps/workflow-runtime/src/compile.ts`. Update the `input` function inside the state loop:

```ts
input: ({ context: machineContext, event }: any) => ({
  params: stateDef.meta?.params as Record<string, unknown> | undefined,
  outputKey: stateDef.meta?.outputKey as string | undefined,
  context: machineContext,
  event,
  instanceId: (machineContext.instanceId ?? context.instanceId) as string,
  stateId
}),
```

- [ ] **Step 2: Set `instanceId` from `ctx.key` in `workflow.ts`**

In `apps/workflow-runtime/src/workflow.ts`, update the `create` handler:

```ts
const context: RuntimeContext = {
  instanceId: ctx.key,
  record: req.record,
  tableName: req.tableName,
  companyId: req.companyId,
  namespace: req.namespace
}
```

And update `runTransition`:

```ts
const context: RuntimeContext = {
  instanceId: ctx.key,
  ...state.context,
  record: { ...(state.context.record ?? {}), ...(event.record ?? {}) },
  tableName: (event.tableName ?? state.context.tableName) as string,
  companyId: (event.companyId ?? state.context.companyId) as string | undefined,
  namespace: (event.namespace ?? state.context.namespace) as string | undefined
}
```

- [ ] **Step 3: Build**

```bash
pnpm --filter workflow-runtime build
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/workflow-runtime/src/compile.ts apps/workflow-runtime/src/workflow.ts
git commit -m "feat(workflow): pass instanceId and stateId to action actors"
```

---

## Task 3: Create `workflow_actions` DB table and helpers

**Files:**
- Modify: `packages/db/src/seed.ts`
- Modify: `packages/db/src/provision.ts`
- Create: `packages/db/src/workflow-actions.ts`
- Modify: `packages/db/package.json`
- Test: `pnpm --filter db typecheck`

- [ ] **Step 1: Add table definitions**

In `packages/db/src/seed.ts`, after the existing `DEFINE TABLE` lines, add:

```ts
DEFINE TABLE IF NOT EXISTS workflow_actions SCHEMALESS;
```

In `packages/db/src/provision.ts`, after the `DEFINE DATABASE` line, add:

```ts
DEFINE TABLE IF NOT EXISTS workflow_actions SCHEMALESS;
```

- [ ] **Step 2: Create DB helpers**

Create `packages/db/src/workflow-actions.ts`:

```ts
import { getSurreal, closeSurreal } from './client.js'

export interface WorkflowActionRecord {
  id: string
  instanceId: string
  workflowId: string
  stateId: string
  action: string
  params?: Record<string, unknown>
  status: 'started' | 'completed' | 'failed'
  inputContext?: Record<string, unknown>
  outputContext?: Record<string, unknown>
  outputData?: unknown
  resultEvent?: 'ok' | 'error' | 'true' | 'false'
  errorMessage?: string
  startedAt: string
  completedAt?: string
}

export async function upsertWorkflowAction(
  namespace: string,
  id: string,
  data: Omit<WorkflowActionRecord, 'id'>
): Promise<WorkflowActionRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[WorkflowActionRecord[]]>(
      'UPSERT type::thing("workflow_actions", $id) CONTENT $data RETURN *',
      { id, data }
    )
    return rows[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listWorkflowActionsByInstance(
  namespace: string,
  instanceId: string
): Promise<WorkflowActionRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<[WorkflowActionRecord[]]>(
      'SELECT * FROM workflow_actions WHERE instanceId = $instanceId ORDER BY startedAt ASC',
      { instanceId }
    )
    return rows ?? []
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 3: Export the new module**

Add to `packages/db/package.json` exports:

```json
"./workflow-actions": {
  "types": "./src/workflow-actions.ts",
  "default": "./src/workflow-actions.ts"
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter db typecheck
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed.ts packages/db/src/provision.ts packages/db/src/workflow-actions.ts packages/db/package.json
git commit -m "feat(db): add workflow_actions table and helpers"
```

---

## Task 4: Write audit rows inside action actors

**Files:**
- Modify: `packages/workflow-actions/src/runtime/index.ts`
- Test: `pnpm --filter workflow-actions typecheck`

- [ ] **Step 1: Import the helper and update actor factory**

Replace the actor loop body in `packages/workflow-actions/src/runtime/index.ts` with:

```ts
import { upsertWorkflowAction } from 'db/workflow-actions'

actors[actionId] = fromPromise(async ({ input }: { input: ActionActorInput }) => {
  const executorCtx: ActionExecutorContext = {
    event: input.event,
    context: input.context,
    record: (input.context.record ?? req.record) as Record<string, unknown>,
    tableName: (input.context.tableName ?? req.tableName) as string,
    companyId: (input.context.companyId ?? req.companyId) as string | undefined,
    namespace: (input.context.namespace ?? req.namespace) as string | undefined,
    instanceId: input.instanceId,
    params: input.params
  }

  const runPromise = objectCtx.run(actionId, async () => {
    const auditId = `${input.instanceId}:${input.stateId}`
    const startedAt = new Date().toISOString()

    await upsertWorkflowAction(executorCtx.namespace ?? '', auditId, {
      instanceId: input.instanceId,
      workflowId: req.config?.id ?? '',
      stateId: input.stateId,
      action: actionId,
      params: input.params,
      status: 'started',
      inputContext: input.context,
      startedAt
    })

    try {
      const data = await runtimeAction.execute(executorCtx)
      const isCondition = actionId === 'condition'
      const resultEvent = isCondition
        ? (data === true ? 'true' : 'false')
        : 'ok'
      const outputContext: Record<string, unknown> = {
        ...input.context,
        ...(input.outputKey ? { [input.outputKey]: data } : {})
      }

      await upsertWorkflowAction(executorCtx.namespace ?? '', auditId, {
        instanceId: input.instanceId,
        workflowId: req.config?.id ?? '',
        stateId: input.stateId,
        action: actionId,
        params: input.params,
        status: 'completed',
        inputContext: input.context,
        outputContext,
        outputData: data,
        resultEvent,
        startedAt,
        completedAt: new Date().toISOString()
      })

      return { data, outputKey: input.outputKey }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await upsertWorkflowAction(executorCtx.namespace ?? '', auditId, {
        instanceId: input.instanceId,
        workflowId: req.config?.id ?? '',
        stateId: input.stateId,
        action: actionId,
        params: input.params,
        status: 'failed',
        inputContext: input.context,
        outputContext: input.context,
        resultEvent: actionId === 'condition' ? 'false' : 'error',
        errorMessage: message,
        startedAt,
        completedAt: new Date().toISOString()
      })
      throw error
    }
  })

  promises.push(runPromise.catch(() => {}))
  return runPromise
})
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter workflow-actions typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add packages/workflow-actions/src/runtime/index.ts
git commit -m "feat(workflow-actions): write workflow_actions audit rows during execution"
```

---

## Task 5: Integration test for `workflow_actions`

**Files:**
- Modify: `apps/workflow-runtime/tests/runtime.test.ts`
- Test: `pnpm --filter workflow-runtime test`

- [ ] **Step 1: Import the helper**

At the top of `apps/workflow-runtime/tests/runtime.test.ts`:

```ts
import { listWorkflowActionsByInstance } from 'db/workflow-actions'
```

- [ ] **Step 2: Add an audit test**

Add a new test inside the `describe('workflow runtime', () => { ... })` block:

```ts
  it('records workflow_actions audit rows', async () => {
    const ns = await createTestNamespace()
    try {
      const instanceId = randomUUID()
      const client = rs.objectClient(workflowObject, instanceId)
      const config: WorkflowDefinition = {
        id: 'audit-test',
        initial: 'create',
        states: {
          create: {
            meta: {
              action: 'createRecord',
              params: {
                table: 'e2e_records',
                fields: { name: 'Alice', status: 'pending' }
              },
              outputKey: 'newRecord'
            },
            on: { ok: { target: 'done' }, error: { target: 'failed' } }
          },
          done: { type: 'final' },
          failed: { type: 'final' }
        }
      }

      const snapshot = await client.create({
        config,
        event: 'start',
        tableName: 'e2e_records',
        record: {},
        namespace: ns,
        workflowId: 'audit-test'
      })

      expect(snapshot.value).toBe('done')

      const actions = await listWorkflowActionsByInstance(ns, instanceId)
      expect(actions.length).toBe(1)
      expect(actions[0].action).toBe('createRecord')
      expect(actions[0].status).toBe('completed')
      expect(actions[0].resultEvent).toBe('ok')
      expect(actions[0].outputData).toMatchObject({ name: 'Alice', status: 'pending' })
    } finally {
      await removeNamespace(ns)
    }
  })
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter workflow-runtime test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/workflow-runtime/tests/runtime.test.ts
git commit -m "test(workflow-runtime): verify workflow_actions audit rows"
```

---

## Task 6: Update documentation

**Files:**
- Modify: `docs/20-Architecture/Data Model.md`
- Modify: `docs/50-Features/Workflow Engine.md`
- Modify: `docs/40-Packages/db.md`
- Test: `pnpm -r build`

- [ ] **Step 1: Update Data Model doc**

In `docs/20-Architecture/Data Model.md`, add `workflow_actions` to both the platform and tenant table lists and include a short description:

```markdown
| `workflow_actions` | Audit/state record for each action-state execution. Stored per instance, keyed by `instanceId:stateId`. |
```

- [ ] **Step 2: Update Workflow Engine doc**

In `docs/50-Features/Workflow Engine.md`, add a section after the instance persistence section:

```markdown
## Action audit

Each action state writes a `workflow_actions` row when entered and updates it when the action completes or fails. The row captures:

- `instanceId`, `stateId`, `action`
- `inputContext` on entry
- `outputContext`, `outputData`, and `resultEvent` on exit
- `errorMessage` on failure

This gives the UI the current action state and a per-instance history.
```

- [ ] **Step 3: Update db package doc**

In `docs/40-Packages/db.md`, add:

```markdown
- `db/workflow-actions` — helpers for the `workflow_actions` audit table (`upsertWorkflowAction`, `listWorkflowActionsByInstance`).
```

Update `updated` to `2026-06-17`.

- [ ] **Step 4: Build**

```bash
pnpm -r build
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add docs/20-Architecture/Data\ Model.md docs/50-Features/Workflow\ Engine.md docs/40-Packages/db.md
git commit -m "docs: document workflow_actions audit table"
```

---

## Task 7: Final verification

- [ ] Run `pnpm --filter workflow-runtime test`.
- [ ] Run `pnpm -r build`.
- [ ] Run `pnpm --filter db typecheck`.
- [ ] Run `pnpm --filter workflow-actions typecheck`.
- [ ] Commit any final fixes.

---

## Self-review

### Spec coverage

| Requirement | Task |
|-------------|------|
| `workflow_actions` table exists in platform and tenant namespaces | Task 3 |
| DB helpers for upsert/list | Task 3 |
| `instanceId` available to actions | Tasks 1–2 |
| Row created on state entry with input context | Task 4 |
| Row updated on state exit with result/output context | Task 4 |
| Integration test verifies audit rows | Task 5 |
| Docs updated | Task 6 |

### Placeholder scan

- No `TBD` or `TODO`.
- Every task includes exact file paths and code.
- Every test task includes expected output.

### Type consistency

- `instanceId` added to `RuntimeContext`, `ActionExecutorContext`, and `ActionActorInput`.
- `WorkflowActionRecord` shape used consistently in DB helpers and runtime writes.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-17-workflow-actions-audit-table.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

Which approach would you like?
