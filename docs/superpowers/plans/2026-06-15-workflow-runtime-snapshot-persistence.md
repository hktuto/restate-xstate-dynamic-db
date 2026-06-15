> **I'm using the writing-plans skill to create the implementation plan.**

# Workflow Runtime Snapshot Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `apps/workflow-runtime` from a one-shot Restate service into a durable Restate Virtual Object that persists XState snapshots, supports multiple events per workflow instance, and replaces hardcoded approvals with generic `waiting` user tasks.

**Architecture:** A single Restate Virtual Object named `workflow` keyed by `workflow_instances` record IDs. Handlers `create`, `send`, `subscribe`, `waitFor`, and `snapshot` manage instance lifecycle. Workflow definitions are still loaded dynamically from SurrealDB and compiled to XState machines on demand. Catalog actions remain sync wrappers around `ctx.run`, and catalog guards remain sync boolean functions. The web/admin dispatch utilities create `workflow_instances` records and call the new handlers. Approval APIs and UI are renamed to `user-tasks`.

**Tech Stack:** TypeScript, `@restatedev/restate-sdk`, `xstate`, SurrealDB, Nuxt/Nitro, pnpm workspace.

---

## File structure

| File | Responsibility |
|---|---|
| `packages/shared/src/index.ts` | `WorkflowState` gains `tags` and `type`; `ExecuteWorkflowRequest` becomes `CreateWorkflowRequest`. |
| `packages/db/src/tenant.ts` | Adds `workflow_instances` and `user_tasks` CRUD for tenant namespaces. |
| `packages/db/src/platform.ts` | Adds `workflow_instances` and `user_tasks` CRUD for platform/admin namespace. |
| `packages/workflow-actions/src/runtime/index.ts` | Accepts `ObjectContext`; builds action/guard registries. |
| `apps/workflow-runtime/src/index.ts` | Restate Virtual Object with `create`, `send`, `subscribe`, `waitFor`, `snapshot`. |
| `apps/workflow-runtime/src/types.ts` | New runtime types (`CreateRequest`, `SendRequest`, `WaitForRequest`, etc.). |
| `apps/workflow-runtime/src/snapshot.ts` | Snapshot restore/persist helpers. |
| `apps/workflow-runtime/src/subscriptions.ts` | `waitFor` subscription evaluation. |
| `apps/web/server/utils/dispatch.ts` | Creates/looks up `workflow_instances` and calls Restate handlers. |
| `apps/admin/server/utils/dispatch.ts` | Same for platform/admin namespace. |
| `apps/web/server/api/user-tasks/*.ts` | Renamed from `approvals`; sends events to workflow instances. |
| `apps/web/app/pages/user-tasks/*.vue` | Renamed from `approvals`. |
| `apps/web/server/api/approvals/*.ts` | Deleted. |
| `apps/web/app/pages/approvals/*.vue` | Deleted. |
| `packages/db/src/seed-workflows.ts` | Updated seed workflow uses `waiting` tag if needed. |
| `apps/workflow-runtime/tests/runtime.test.ts` | Integration tests with `@restatedev/restate-sdk-testcontainers`. |

---

## Task 1: Extend shared types

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add `tags` and `type` to `WorkflowState`**

```ts
export interface WorkflowState {
  entry?: (string | { id: string; params?: Record<string, unknown> })[]
  on?: Record<string, WorkflowTransition | WorkflowTransition[]>
  tags?: string[]
  type?: 'final'
}
```

- [ ] **Step 2: Add `meta` to `WorkflowState` for task type**

```ts
export interface WorkflowState {
  entry?: (string | { id: string; params?: Record<string, unknown> })[]
  on?: Record<string, WorkflowTransition | WorkflowTransition[]>
  tags?: string[]
  type?: 'final'
  meta?: Record<string, unknown>
}
```

- [ ] **Step 3: Rename `ExecuteWorkflowRequest` to `CreateWorkflowRequest` and extend it**

```ts
export interface CreateWorkflowRequest {
  config: WorkflowDefinition
  event?: string
  tableName: string
  record: Record<string, unknown>
  workflowId: string
  companyId?: string
  namespace?: string
}

export interface SendWorkflowRequest {
  event: string
  record?: Record<string, unknown>
}

export interface WaitForWorkflowRequest {
  condition: 'done' | `hasTag:${string}`
  timeout?: number
  event?: string
}
```

- [ ] **Step 4: Run type check**

```bash
pnpm --filter shared build
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add workflow state tags and runtime request types"
```

---

## Task 2: Add tenant DB methods for instances and user tasks

**Files:**
- Modify: `packages/db/src/tenant.ts`

- [ ] **Step 1: Add `WorkflowInstanceRecord`, `WorkflowInstanceInput`, and `WorkflowInstanceStatus` types**

Append to `packages/db/src/tenant.ts` after `ApprovalRecord`:

```ts
export type WorkflowInstanceStatus = 'pending' | 'running' | 'waiting' | 'done' | 'error'

export interface WorkflowInstanceRecord {
  id: string
  workflowId: string
  tableName: string
  recordId: string
  namespace: string
  companyId?: string
  status: WorkflowInstanceStatus
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface WorkflowInstanceInput {
  workflowId: string
  tableName: string
  recordId: string
  namespace: string
  companyId?: string
  status?: WorkflowInstanceStatus
}

export async function listWorkflowInstances(namespace: string): Promise<WorkflowInstanceRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [instances] = await surreal.query<[WorkflowInstanceRecord[]]>('SELECT * FROM workflow_instances ORDER BY createdAt DESC')
    return instances
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getWorkflowInstance(namespace: string, id: string): Promise<WorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[WorkflowInstanceRecord[]]>('SELECT * FROM workflow_instances WHERE id = $id LIMIT 1', { id })
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function findActiveWorkflowInstance(
  namespace: string,
  workflowId: string,
  recordId: string
): Promise<WorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[WorkflowInstanceRecord[]]>(
      `SELECT * FROM workflow_instances
       WHERE workflowId = $workflowId AND recordId = $recordId
       AND status IN ['pending', 'running', 'waiting']
       ORDER BY createdAt DESC
       LIMIT 1`,
      { workflowId, recordId }
    )
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createWorkflowInstance(namespace: string, input: WorkflowInstanceInput): Promise<WorkflowInstanceRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const now = new Date().toISOString()
    const data = {
      ...input,
      status: input.status ?? 'pending',
      createdAt: now,
      updatedAt: now
    }
    const [created] = await surreal.query<[WorkflowInstanceRecord[]]>('CREATE workflow_instances CONTENT $data', { data })
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateWorkflowInstanceStatus(
  namespace: string,
  id: string,
  status: WorkflowInstanceStatus
): Promise<WorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [updated] = await surreal.query<[WorkflowInstanceRecord[]]>(
      'UPDATE $id MERGE $data',
      { id, data: { status, updatedAt: new Date().toISOString() } }
    )
    return updated[0]
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 2: Add `UserTaskRecord`, `UserTaskInput`, and `UserTaskStatus` types**

Append after the instance functions:

```ts
export type UserTaskStatus = 'pending' | 'completed' | 'cancelled' | 'rejected'
export type UserTaskType = 'approval' | 'review' | 'manual'

export interface UserTaskRecord {
  id: string
  instanceId: string
  type: UserTaskType
  status: UserTaskStatus
  tableName: string
  recordId: string
  workflowId: string
  createdAt: string
  resolvedAt?: string
  [key: string]: unknown
}

export interface UserTaskInput {
  instanceId: string
  type: UserTaskType
  tableName: string
  recordId: string
  workflowId: string
}

export async function listUserTasks(namespace: string): Promise<UserTaskRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [tasks] = await surreal.query<[UserTaskRecord[]]>('SELECT * FROM user_tasks ORDER BY createdAt DESC')
    return tasks
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getUserTaskById(namespace: string, id: string): Promise<UserTaskRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[UserTaskRecord[]]>('SELECT * FROM user_tasks WHERE id = $id LIMIT 1', { id })
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createUserTask(namespace: string, input: UserTaskInput): Promise<UserTaskRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data = {
      ...input,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[UserTaskRecord[]]>('CREATE user_tasks CONTENT $data', { data })
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateUserTaskStatus(
  namespace: string,
  id: string,
  status: UserTaskStatus
): Promise<UserTaskRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [updated] = await surreal.query<[UserTaskRecord[]]>(
      'UPDATE $id MERGE $data',
      { id, data: { status, resolvedAt: new Date().toISOString() } }
    )
    return updated[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deleteUserTask(namespace: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query('DELETE $id', { id })
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 3: Remove old `ApprovalRecord` and approval functions**

Delete from `packages/db/src/tenant.ts`:

- `ApprovalRecord`
- `ApprovalInput`
- `listApprovals`
- `getApprovalById`
- `createApproval`
- `updateApprovalStatus`
- `deleteApproval`

- [ ] **Step 4: Run type check**

```bash
pnpm --filter db build
```

Expected: passes (or surfaces callers that still import approval types; fix in later tasks).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/tenant.ts
git commit -m "feat(db): add workflow_instances and user_tasks, remove approvals"
```

---

## Task 3: Add platform DB methods for instances and user tasks

**Files:**
- Modify: `packages/db/src/platform.ts`

- [ ] **Step 1: Add types and CRUD functions mirroring tenant.ts**

Append to `packages/db/src/platform.ts` after the existing platform trigger functions:

```ts
export type PlatformWorkflowInstanceStatus = 'pending' | 'running' | 'waiting' | 'done' | 'error'

export interface PlatformWorkflowInstanceRecord {
  id: string
  workflowId: string
  tableName: string
  recordId: string
  namespace: string
  companyId?: string
  status: PlatformWorkflowInstanceStatus
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface PlatformWorkflowInstanceInput {
  workflowId: string
  tableName: string
  recordId: string
  namespace: string
  companyId?: string
  status?: PlatformWorkflowInstanceStatus
}

export async function listPlatformWorkflowInstances(): Promise<PlatformWorkflowInstanceRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [instances] = await surreal.query<[PlatformWorkflowInstanceRecord[]]>('SELECT * FROM workflow_instances ORDER BY createdAt DESC')
    return instances
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformWorkflowInstance(id: string): Promise<PlatformWorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[PlatformWorkflowInstanceRecord[]]>('SELECT * FROM workflow_instances WHERE id = $id LIMIT 1', { id })
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function findActivePlatformWorkflowInstance(
  workflowId: string,
  recordId: string
): Promise<PlatformWorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[PlatformWorkflowInstanceRecord[]]>(
      `SELECT * FROM workflow_instances
       WHERE workflowId = $workflowId AND recordId = $recordId
       AND status IN ['pending', 'running', 'waiting']
       ORDER BY createdAt DESC
       LIMIT 1`,
      { workflowId, recordId }
    )
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createPlatformWorkflowInstance(input: PlatformWorkflowInstanceInput): Promise<PlatformWorkflowInstanceRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const now = new Date().toISOString()
    const data = {
      ...input,
      status: input.status ?? 'pending',
      createdAt: now,
      updatedAt: now
    }
    const [created] = await surreal.query<[PlatformWorkflowInstanceRecord[]]>('CREATE workflow_instances CONTENT $data', { data })
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePlatformWorkflowInstanceStatus(
  id: string,
  status: PlatformWorkflowInstanceStatus
): Promise<PlatformWorkflowInstanceRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [updated] = await surreal.query<[PlatformWorkflowInstanceRecord[]]>(
      'UPDATE $id MERGE $data',
      { id, data: { status, updatedAt: new Date().toISOString() } }
    )
    return updated[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export type PlatformUserTaskStatus = 'pending' | 'completed' | 'cancelled' | 'rejected'
export type PlatformUserTaskType = 'approval' | 'review' | 'manual'

export interface PlatformUserTaskRecord {
  id: string
  instanceId: string
  type: PlatformUserTaskType
  status: PlatformUserTaskStatus
  tableName: string
  recordId: string
  workflowId: string
  createdAt: string
  resolvedAt?: string
  [key: string]: unknown
}

export interface PlatformUserTaskInput {
  instanceId: string
  type: PlatformUserTaskType
  tableName: string
  recordId: string
  workflowId: string
}

export async function listPlatformUserTasks(): Promise<PlatformUserTaskRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [tasks] = await surreal.query<[PlatformUserTaskRecord[]]>('SELECT * FROM user_tasks ORDER BY createdAt DESC')
    return tasks
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPlatformUserTaskById(id: string): Promise<PlatformUserTaskRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[PlatformUserTaskRecord[]]>('SELECT * FROM user_tasks WHERE id = $id LIMIT 1', { id })
    return result[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createPlatformUserTask(input: PlatformUserTaskInput): Promise<PlatformUserTaskRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data = {
      ...input,
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    const [created] = await surreal.query<[PlatformUserTaskRecord[]]>('CREATE user_tasks CONTENT $data', { data })
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePlatformUserTaskStatus(
  id: string,
  status: PlatformUserTaskStatus
): Promise<PlatformUserTaskRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [updated] = await surreal.query<[PlatformUserTaskRecord[]]>(
      'UPDATE $id MERGE $data',
      { id, data: { status, resolvedAt: new Date().toISOString() } }
    )
    return updated[0]
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 2: Run type check**

```bash
pnpm --filter db build
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/platform.ts
git commit -m "feat(db): add platform workflow_instances and user_tasks"
```

---

## Task 4: Update workflow-actions runtime for ObjectContext

**Files:**
- Modify: `packages/workflow-actions/src/runtime/index.ts`

- [ ] **Step 1: Change `createActionRegistry` to accept `ObjectContext`**

```ts
import type { ObjectContext } from '@restatedev/restate-sdk'

export function createActionRegistry(
  ctx: Pick<ObjectContext, 'run'>,
  req: CreateWorkflowRequest
): ActionRegistry {
  // existing implementation
}
```

Replace the existing `ctx: { run: ... }` parameter type.

- [ ] **Step 2: Verify `createGuardRegistry` still works**

No change needed; it does not use Restate context.

- [ ] **Step 3: Run type check**

```bash
pnpm --filter workflow-actions build
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add packages/workflow-actions/src/runtime/index.ts
git commit -m "feat(workflow-actions): accept ObjectContext in action registry"
```

---

## Task 5: Create runtime helper files

**Files:**
- Create: `apps/workflow-runtime/src/types.ts`
- Create: `apps/workflow-runtime/src/snapshot.ts`
- Create: `apps/workflow-runtime/src/subscriptions.ts`
- Create: `apps/workflow-runtime/src/compile.ts`

- [ ] **Step 1: Create `apps/workflow-runtime/src/types.ts`**

```ts
import type { AnyMachineSnapshot, AnyStateMachine } from 'xstate'
import type { CreateWorkflowRequest, SendWorkflowRequest, WaitForWorkflowRequest } from 'shared'

export type { CreateWorkflowRequest, SendWorkflowRequest, WaitForWorkflowRequest }

export interface RuntimeContext {
  record: Record<string, unknown>
  tableName: string
  companyId?: string
  namespace?: string
}

export interface PersistedState {
  schemaVersion: number
  snapshot: AnyMachineSnapshot
  config: CreateWorkflowRequest['config']
  context: RuntimeContext
  subscriptions: Record<string, Subscription>
}

export interface Subscription {
  awakeables: string[]
}

export type Condition = 'done' | `hasTag:${string}`
```

- [ ] **Step 2: Create `apps/workflow-runtime/src/compile.ts`**

```ts
import { createMachine } from 'xstate'
import type { AnyStateMachine } from 'xstate'
import type { WorkflowDefinition } from 'shared'
import { createActionRegistry, createGuardRegistry } from 'workflow-actions/runtime'
import type { RuntimeContext } from './types.js'

export function compileWorkflow(
  definition: WorkflowDefinition,
  context: RuntimeContext,
  ctx: { run: (name: string, fn: () => Promise<void> | void) => Promise<unknown> }
): AnyStateMachine {
  const registry = createActionRegistry(ctx, {
    config: definition,
    event: '',
    tableName: context.tableName,
    record: context.record,
    workflowId: definition.id,
    companyId: context.companyId,
    namespace: context.namespace
  })
  const guardRegistry = createGuardRegistry({
    config: definition,
    event: '',
    tableName: context.tableName,
    record: context.record,
    workflowId: definition.id,
    companyId: context.companyId,
    namespace: context.namespace
  })

  const states: Record<string, any> = {}
  for (const [stateId, stateDef] of Object.entries(definition.states)) {
    states[stateId] = {}
    if (stateDef.entry?.length) {
      states[stateId].entry = stateDef.entry.map(entry =>
        typeof entry === 'string' ? entry : { type: entry.id }
      )
    }
    if (stateDef.on) {
      states[stateId].on = stateDef.on
    }
    if (stateDef.tags) {
      states[stateId].tags = stateDef.tags
    }
    if (stateDef.type === 'final') {
      states[stateId].type = 'final'
    }
  }

  return createMachine(
    {
      ...definition,
      context: {
        ...context
      },
      states
    },
    {
      actions: registry.actions,
      guards: guardRegistry.guards
    }
  ) as AnyStateMachine
}
```

- [ ] **Step 3: Create `apps/workflow-runtime/src/snapshot.ts`**

```ts
import { createActor } from 'xstate'
import type { AnyStateMachine, AnyMachineSnapshot } from 'xstate'

export function restoreActor(machine: AnyStateMachine, snapshot?: AnyMachineSnapshot) {
  const actor = createActor(machine)
  actor.start(snapshot)
  return actor
}

export function getSnapshot(actor: any): AnyMachineSnapshot {
  return actor.getPersistedSnapshot()
}
```

- [ ] **Step 4: Create `apps/workflow-runtime/src/subscriptions.ts`**

```ts
import type { ObjectContext } from '@restatedev/restate-sdk'
import type { AnyMachineSnapshot } from 'xstate'
import type { Condition, PersistedState, Subscription } from './types.js'

export function evaluateCondition(snapshot: AnyMachineSnapshot, condition: Condition): boolean {
  if (condition === 'done') {
    return snapshot.status === 'done'
  }
  if (condition.startsWith('hasTag:')) {
    return snapshot.hasTag(condition.slice(7))
  }
  return false
}

export async function resolveMatchingSubscriptions(
  ctx: ObjectContext,
  snapshot: AnyMachineSnapshot
) {
  const state = (await ctx.get<PersistedState>('state'))
  if (!state?.subscriptions) return

  for (const [condition, subscription] of Object.entries(state.subscriptions)) {
    if (evaluateCondition(snapshot, condition as Condition)) {
      for (const awakeableId of subscription.awakeables) {
        ctx.resolveAwakeable(awakeableId, snapshot)
      }
      delete state.subscriptions[condition]
    }
  }

  ctx.set('state', state)
}

export async function registerSubscription(
  ctx: ObjectContext,
  condition: Condition,
  awakeableId: string
) {
  const state = await ctx.get<PersistedState>('state')
  if (!state) {
    throw new Error('Cannot register subscription: workflow state not found')
  }
  if (!state.subscriptions) state.subscriptions = {}

  const existing = state.subscriptions[condition] as Subscription | undefined
  if (existing) {
    existing.awakeables.push(awakeableId)
  } else {
    state.subscriptions[condition] = { awakeables: [awakeableId] }
  }

  ctx.set('state', state)
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/workflow-runtime/src/types.ts apps/workflow-runtime/src/compile.ts apps/workflow-runtime/src/snapshot.ts apps/workflow-runtime/src/subscriptions.ts
git commit -m "feat(workflow-runtime): add runtime helpers for compile, snapshot, and subscriptions"
```

---

## Task 6: Create `apps/workflow-runtime/src/workflow.ts` and update `index.ts`

**Files:**
- Create: `apps/workflow-runtime/src/workflow.ts`
- Modify: `apps/workflow-runtime/src/index.ts`

- [ ] **Step 1: Create `apps/workflow-runtime/src/workflow.ts` with the Virtual Object definition**

Move the object definition into this file so tests can import it without starting a server. Export `workflowObject`, `loadState`, `saveState`, and `SCHEMA_VERSION`.

```ts
import * as restate from '@restatedev/restate-sdk'
import type { AnyMachineSnapshot, AnyStateMachine } from 'xstate'
import { createActor } from 'xstate'
import type { CreateWorkflowRequest, SendWorkflowRequest, WaitForWorkflowRequest } from 'shared'
import { compileWorkflow } from './compile.js'
import { restoreActor, getSnapshot } from './snapshot.js'
import { evaluateCondition, registerSubscription, resolveMatchingSubscriptions } from './subscriptions.js'
import type { Condition, PersistedState, RuntimeContext } from './types.js'

export const SCHEMA_VERSION = 1
const NITRO_API_URL = process.env.NITRO_API_URL || 'http://localhost:3000'

function toRuntimeContext(req: CreateWorkflowRequest): RuntimeContext {
  return {
    record: req.record,
    tableName: req.tableName,
    companyId: req.companyId,
    namespace: req.namespace
  }
}

export async function loadState(ctx: restate.ObjectContext | restate.ObjectSharedContext): Promise<PersistedState | undefined> {
  return await ctx.get<PersistedState>('state')
}

export async function saveState(
  ctx: restate.ObjectContext,
  partial: Partial<PersistedState> & Pick<PersistedState, 'snapshot' | 'config' | 'context'>
) {
  const existing = (await loadState(ctx)) ?? {
    schemaVersion: SCHEMA_VERSION,
    snapshot: partial.snapshot,
    config: partial.config,
    context: partial.context,
    subscriptions: {}
  }
  const next: PersistedState = { ...existing, ...partial, schemaVersion: SCHEMA_VERSION }
  ctx.set('state', next)
  return next
}

function getTaskType(machine: AnyStateMachine, snapshot: AnyMachineSnapshot): 'approval' | 'review' | 'manual' {
  try {
    const stateNode = machine.getStateNodeById(String(snapshot.value))
    return (stateNode.config.meta?.taskType as 'approval' | 'review' | 'manual') ?? 'approval'
  } catch {
    return 'approval'
  }
}

async function maybeCreateUserTask(
  ctx: restate.ObjectContext,
  machine: AnyStateMachine,
  snapshot: AnyMachineSnapshot,
  state: PersistedState
) {
  if (!snapshot.hasTag('waiting')) return

  const taskType = getTaskType(machine, snapshot)
  await ctx.run('createUserTask', async () => {
    const res = await fetch(`${NITRO_API_URL}/api/user-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceId: ctx.key,
        type: taskType,
        tableName: state.context.tableName,
        recordId: state.context.record.id,
        workflowId: state.config.id,
        namespace: state.context.namespace
      })
    })
    if (!res.ok) {
      throw new Error(`Failed to create user task: ${res.status}`)
    }
  })
}

async function runTransition(
  ctx: restate.ObjectContext,
  state: PersistedState,
  event: { type: string; record?: Record<string, unknown> }
): Promise<AnyMachineSnapshot> {
  const context: RuntimeContext = {
    ...state.context,
    ...(event.record ? { record: event.record } : {})
  }
  const machine = compileWorkflow(state.config, context, ctx)
  const actor = restoreActor(machine, state.snapshot)
  actor.send(event as any)
  const snapshot = getSnapshot(actor)
  actor.stop()
  return snapshot
}

async function updateInstanceStatus(
  ctx: restate.ObjectContext,
  snapshot: AnyMachineSnapshot,
  namespace?: string
) {
  let status: 'pending' | 'running' | 'waiting' | 'done' | 'error' = 'running'
  if (snapshot.status === 'done') status = 'done'
  else if (snapshot.status === 'error') status = 'error'
  else if (snapshot.hasTag('waiting')) status = 'waiting'

  await ctx.run('updateInstanceStatus', async () => {
    const res = await fetch(`${NITRO_API_URL}/api/workflow-instances/${ctx.key}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, namespace })
    })
    if (!res.ok) {
      throw new Error(`Failed to update instance status: ${res.status}`)
    }
  })
}

export const workflowObject = restate.object({
  name: 'workflow',
  handlers: {
    create: async (ctx: restate.ObjectContext, req: CreateWorkflowRequest) => {
      const existing = await loadState(ctx)
      if (existing) {
        return existing.snapshot
      }

      const context = toRuntimeContext(req)
      const machine = compileWorkflow(req.config, context, ctx)
      const actor = createActor(machine)
      actor.start()
      if (req.event) {
        actor.send({ type: req.event, record: req.record } as any)
      }
      const snapshot = getSnapshot(actor)
      actor.stop()

      const state = await saveState(ctx, {
        snapshot,
        config: req.config,
        context
      })

      await maybeCreateUserTask(ctx, machine, snapshot, state)
      await resolveMatchingSubscriptions(ctx, snapshot)
      await updateInstanceStatus(ctx, snapshot, context.namespace)

      return snapshot
    },

    send: async (ctx: restate.ObjectContext, req: SendWorkflowRequest) => {
      const state = await loadState(ctx)
      if (!state) {
        throw new restate.TerminalError('Workflow instance not found', { errorCode: 404 })
      }

      const context: RuntimeContext = {
        ...state.context,
        ...(req.record ? { record: req.record } : {})
      }
      const machine = compileWorkflow(state.config, context, ctx)
      const snapshot = await runTransition(ctx, state, { type: req.event, record: req.record })
      const nextState = await saveState(ctx, {
        snapshot,
        context
      })

      await maybeCreateUserTask(ctx, machine, snapshot, nextState)
      await resolveMatchingSubscriptions(ctx, snapshot)
      await updateInstanceStatus(ctx, snapshot, context.namespace)

      return snapshot
    },

    subscribe: async (
      ctx: restate.ObjectContext,
      req: { condition: Condition; awakeableId: string }
    ) => {
      const state = await loadState(ctx)
      if (!state) {
        throw new restate.TerminalError('Workflow instance not found', { errorCode: 404 })
      }

      if (evaluateCondition(state.snapshot, req.condition)) {
        ctx.resolveAwakeable(req.awakeableId, state.snapshot)
        return
      }

      await registerSubscription(ctx, req.condition, req.awakeableId)
    },

    waitFor: restate.handlers.object.shared(
      async (ctx: restate.ObjectSharedContext, req: WaitForWorkflowRequest) => {
        const state = await loadState(ctx)
        if (!state) {
          throw new restate.TerminalError('Workflow instance not found', { errorCode: 404 })
        }

        if (evaluateCondition(state.snapshot, req.condition as Condition)) {
          return state.snapshot
        }

        const { id, promise } = ctx.awakeable<AnyMachineSnapshot>()

        if (req.event) {
          await ctx.objectClient(workflowObject, ctx.key).send({ event: req.event })
        }

        await ctx.objectClient(workflowObject, ctx.key).subscribe({
          condition: req.condition as Condition,
          awakeableId: id
        })

        if (req.timeout !== undefined) {
          return await promise.orTimeout(req.timeout)
        }
        return await promise
      }
    ),

    snapshot: async (ctx: restate.ObjectContext) => {
      const state = await loadState(ctx)
      if (!state) {
        throw new restate.TerminalError('Workflow instance not found', { errorCode: 404 })
      }
      return state.snapshot
    }
  }
})

```

- [ ] **Step 2: Update `apps/workflow-runtime/src/index.ts` to serve the exported object**

```ts
import * as restate from '@restatedev/restate-sdk'
import { workflowObject } from './workflow.js'

restate.serve({ services: [workflowObject], port: 9080 })
```

- [ ] **Step 3: Document handler concurrency**

`create`, `send`, and `subscribe` are exclusive handlers that can mutate Restate state and run actions. `waitFor` and `snapshot` are shared handlers. `waitFor` delegates any event send and subscription registration to the exclusive handlers so it does not need to write state.

- [ ] **Step 4: Run type check**

```bash
pnpm --filter workflow-runtime build
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/workflow-runtime/src/workflow.ts apps/workflow-runtime/src/index.ts
git commit -m "feat(workflow-runtime): rewrite as Restate Virtual Object with create/send/subscribe/waitFor/snapshot"
```

---

## Task 7: Add Nitro endpoints for instance status and user tasks

**Files:**
- Create: `apps/web/server/api/workflow-instances/[id]/status.patch.ts`
- Create: `apps/web/server/api/user-tasks/index.post.ts`
- Modify: `apps/web/server/api/user-tasks/index.get.ts` (renamed from approvals)

- [ ] **Step 1: Create `apps/web/server/api/workflow-instances/[id]/status.patch.ts`**

```ts
import { updateWorkflowInstanceStatus, getWorkflowInstance } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const namespace = body.namespace ?? event.context.company?.namespace
  if (!namespace) {
    throw createError({ statusCode: 400, statusMessage: 'Namespace required' })
  }

  const existing = await getWorkflowInstance(namespace, id)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Instance not found' })

  const updated = await updateWorkflowInstanceStatus(namespace, id, body.status)
  return updated
})
```

- [ ] **Step 2: Create `apps/web/server/api/user-tasks/index.post.ts`**

```ts
import { createUserTask } from 'db/tenant'
import type { UserTaskInput } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const body = await readBody<UserTaskInput & { namespace: string }>(event)
  const namespace = body.namespace ?? event.context.company?.namespace
  if (!namespace) {
    throw createError({ statusCode: 400, statusMessage: 'Namespace required' })
  }
  const task = await createUserTask(namespace, body)
  return task
})
```

- [ ] **Step 3: Rename `apps/web/server/api/approvals/index.get.ts` to `apps/web/server/api/user-tasks/index.get.ts`**

```ts
import { listUserTasks, getMemberById } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const namespace = event.context.company.namespace
  const tasks = await listUserTasks(namespace)
  return await Promise.all(
    tasks.map(async (t) => {
      if (t.tableName !== 'members') return t
      const member = await getMemberById(namespace, t.recordId)
      return { ...t, member }
    })
  )
})
```

- [ ] **Step 4: Delete old approval API files**

Delete:
- `apps/web/server/api/approvals/index.get.ts`
- `apps/web/server/api/approvals/index.post.ts`
- `apps/web/server/api/approvals/[id].delete.ts`
- `apps/web/server/api/approvals/[id]/approve.post.ts`
- `apps/web/server/api/approvals/[id]/reject.post.ts`

- [ ] **Step 5: Create approve/reject endpoints under user-tasks**

Create `apps/web/server/api/user-tasks/[id]/approve.post.ts`:

```ts
import { getUserTaskById, updateUserTaskStatus } from 'db/tenant'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const namespace = event.context.company.namespace

  const task = await getUserTaskById(namespace, id)
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  const res = await fetch(`${RESTATE_INGRESS}/workflow/${task.instanceId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'approve' })
  })
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `Workflow send failed: ${res.status}` })
  }

  await updateUserTaskStatus(namespace, id, 'completed')
  return { ok: true }
})
```

Create `apps/web/server/api/user-tasks/[id]/reject.post.ts`:

```ts
import { getUserTaskById, updateUserTaskStatus } from 'db/tenant'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const namespace = event.context.company.namespace

  const task = await getUserTaskById(namespace, id)
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  const res = await fetch(`${RESTATE_INGRESS}/workflow/${task.instanceId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'reject' })
  })
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `Workflow send failed: ${res.status}` })
  }

  await updateUserTaskStatus(namespace, id, 'rejected')
  return { ok: true }
})
```

- [ ] **Step 6: Run type check for web**

```bash
pnpm --filter web build
```

Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add apps/web/server/api/workflow-instances apps/web/server/api/user-tasks
git add -u apps/web/server/api/approvals
git commit -m "feat(web): add workflow instance status and user-tasks API, remove approvals"
```

---

## Task 8: Update tenant dispatch utility

**Files:**
- Modify: `apps/web/server/utils/dispatch.ts`

- [ ] **Step 1: Replace `executeWorkflow` call with create/send flow**

```ts
import type { H3Event } from 'h3'
import { listTriggers, getWorkflow, findActiveWorkflowInstance, createWorkflowInstance } from 'db/tenant'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'

export async function dispatchTrigger(event: H3Event, tableName: string, crudEvent: string, record: Record<string, unknown>) {
  if (getHeader(event, 'x-restate-skip-trigger')) {
    return
  }

  const namespace = event.context.company?.namespace
  if (!namespace) {
    console.error('No company namespace in context for trigger dispatch')
    return
  }

  const companyId = event.context.company?.id

  const triggers = await listTriggers(namespace)
  const matching = triggers.filter(t => t.tableName === tableName && t.event === crudEvent)
  if (!matching.length) return

  for (const trigger of matching) {
    const workflow = await getWorkflow(namespace, trigger.workflowId)
    if (!workflow) {
      console.error(`Workflow ${trigger.workflowId} not found for trigger ${trigger.id}`)
      continue
    }

    let instance = await findActiveWorkflowInstance(namespace, trigger.workflowId, String(record.id))
    let instanceId: string
    let handler: 'create' | 'send' = 'create'

    if (instance) {
      instanceId = instance.id
      handler = 'send'
    } else {
      instance = await createWorkflowInstance(namespace, {
        workflowId: trigger.workflowId,
        tableName,
        recordId: String(record.id),
        namespace,
        companyId
      })
      instanceId = instance.id
    }

    const payload = handler === 'create'
      ? {
          config: workflow.xstateConfig,
          event: crudEvent,
          tableName,
          record,
          workflowId: trigger.workflowId,
          companyId,
          namespace
        }
      : { event: crudEvent, record }

    fetch(`${RESTATE_INGRESS}/workflow/${instanceId}/${handler}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        if (!res.ok) {
          console.error(`Restate trigger dispatch failed: ${res.status} ${await res.text()}`)
        }
      })
      .catch(err => {
        console.error('Restate trigger dispatch error:', err)
      })
  }
}
```

- [ ] **Step 2: Run type check**

```bash
pnpm --filter web build
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/utils/dispatch.ts
git commit -m "feat(web): dispatch triggers to workflow create/send handlers"
```

---

## Task 9: Update admin/platform dispatch utility

**Files:**
- Modify: `apps/admin/server/utils/dispatch.ts`

- [ ] **Step 1: Replace `executeWorkflow` call with create/send flow**

```ts
import { getSurreal, closeSurreal } from 'db'
import type { H3Event } from 'h3'
import { findActivePlatformWorkflowInstance, createPlatformWorkflowInstance } from 'db/platform'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'

export async function dispatchTrigger(event: H3Event, tableName: string, crudEvent: string, record: Record<string, unknown>) {
  if (getHeader(event, 'x-restate-skip-trigger')) {
    return
  }

  const surreal = await getSurreal('platform', 'admin')
  try {
    const [rows] = await surreal.query<[any[]]>(
      'SELECT * FROM triggers WHERE tableName = $tableName AND event = $event',
      { tableName, event: crudEvent }
    )
    if (!rows.length) return

    for (const trigger of rows) {
      const [workflows] = await surreal.query<[any[]]>(
        'SELECT * FROM workflows WHERE id = $id',
        { id: trigger.workflowId }
      )
      const workflow = workflows[0]
      if (!workflow) {
        console.error(`Workflow ${trigger.workflowId} not found for trigger ${trigger.id}`)
        continue
      }

      let instance = await findActivePlatformWorkflowInstance(trigger.workflowId, String(record.id))
      let instanceId: string
      let handler: 'create' | 'send' = 'create'

      if (instance) {
        instanceId = instance.id
        handler = 'send'
      } else {
        instance = await createPlatformWorkflowInstance({
          workflowId: trigger.workflowId,
          tableName,
          recordId: String(record.id),
          namespace: (record as any).namespace,
          companyId: String(record.id)
        })
        instanceId = instance.id
      }

      const payload = handler === 'create'
        ? {
            config: workflow.xstateConfig,
            event: crudEvent,
            tableName,
            record,
            workflowId: trigger.workflowId,
            companyId: record.id,
            namespace: (record as any).namespace
          }
        : { event: crudEvent, record }

      fetch(`${RESTATE_INGRESS}/workflow/${instanceId}/${handler}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(async res => {
          if (!res.ok) {
            console.error(`Restate trigger dispatch failed: ${res.status} ${await res.text()}`)
          }
        })
        .catch(err => {
          console.error('Restate trigger dispatch error:', err)
        })
    }
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 2: Run type check**

```bash
pnpm --filter admin build
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/server/utils/dispatch.ts
git commit -m "feat(admin): dispatch platform triggers to workflow create/send handlers"
```

---

## Task 10: Rename approvals UI to user-tasks

**Files:**
- Rename: `apps/web/app/pages/approvals/index.vue` → `apps/web/app/pages/user-tasks/index.vue`
- Modify content to reference `user-tasks` API and terminology.

- [ ] **Step 1: Rename file and update API paths**

Replace all occurrences of `/api/approvals` with `/api/user-tasks` and approval-specific labels with task labels. The exact template code depends on the current approvals page; update fetch calls and action buttons.

- [ ] **Step 2: Delete old approvals page**

Remove `apps/web/app/pages/approvals/index.vue` after confirming the renamed file is correct.

- [ ] **Step 3: Commit**

```bash
git add -u apps/web/app/pages
git commit -m "feat(web): rename approvals page to user-tasks"
```

---

## Task 11: Update seed workflow

**Files:**
- Modify: `packages/db/src/seed-workflows.ts`

- [ ] **Step 1: Add a `waiting` example to the seed or keep provisioning simple**

The current `provisionCompany` workflow is run-to-completion. Keep it simple for the seed, but ensure the runtime handles it. No code change required unless you want to demonstrate multi-event.

If demonstrating multi-event, update to:

```ts
const workflowConfig = {
  id: 'provisionCompany',
  initial: 'idle',
  states: {
    idle: {
      on: { create: 'provisioning' }
    },
    provisioning: {
      entry: ['provisionCompanyNamespace'],
      on: { provisioned: 'active' }
    },
    active: { type: 'final' }
  }
}
```

And update `provisionCompanyNamespace` action to send a `provisioned` event if needed. For this plan, keep the original seed unchanged.

- [ ] **Step 2: Commit**

If unchanged, skip. If changed:

```bash
git add packages/db/src/seed-workflows.ts
git commit -m "chore(db): update seed workflow"
```

---

## Task 12: Add integration tests

**Files:**
- Create: `apps/workflow-runtime/tests/runtime.test.ts`

- [ ] **Step 1: Add test dependencies**

```bash
pnpm --filter workflow-runtime add -D @restatedev/restate-sdk-testcontainers vitest
```

- [ ] **Step 2: Write a basic test**

```ts
import { describe, it, expect } from 'vitest'
import { restate } from '@restatedev/restate-sdk'
import { TestEnvironment } from '@restatedev/restate-sdk-testcontainers'
import { workflowObject } from '../src/workflow.js'

describe('workflow runtime', () => {
  const env = new TestEnvironment()

  it('creates and sends events to a workflow instance', async () => {
    const client = env.objectClient(workflowObject, 'instance-1')

    const config = {
      id: 'test',
      initial: 'idle',
      states: {
        idle: { on: { start: 'running' } },
        running: { tags: ['waiting'], on: { finish: 'done' } },
        done: { type: 'final' }
      }
    }

    const snapshot1 = await client.create({ config, event: 'start', tableName: 'tests', record: { id: '1' }, workflowId: 'test' })
    expect(snapshot1.value).toBe('running')
    expect(snapshot1.hasTag('waiting')).toBe(true)

    const snapshot2 = await client.send({ event: 'finish' })
    expect(snapshot2.value).toBe('done')
    expect(snapshot2.status).toBe('done')
  })
})
```

- [ ] **Step 3: Add test script to package.json**

```json
"scripts": {
  "test": "vitest run"
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter workflow-runtime test
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/workflow-runtime/tests apps/workflow-runtime/package.json
git commit -m "test(workflow-runtime): add runtime integration tests"
```

---

## Task 13: Update documentation

**Files:**
- Modify: `docs/30-Apps/Workflow Runtime/Overview.md`
- Modify: `docs/50-Features/Workflow Engine.md`
- Modify: `docs/50-Features/Guards & Conditions.md`

- [ ] **Step 1: Update workflow runtime overview**

Document the new Virtual Object API, instance keying, snapshot persistence, and `waiting` tag behavior.

- [ ] **Step 2: Update workflow engine feature note**

Document multi-event support and the trigger-to-instance mapping rule.

- [ ] **Step 3: Update approvals feature note or create user-tasks note**

Rename `docs/50-Features/Approvals.md` to `docs/50-Features/User Tasks.md` if it exists, or update the relevant note.

- [ ] **Step 4: Run frontmatter script**

```bash
node docs/scripts/apply-frontmatter.cjs --force
```

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: update workflow runtime and user task documentation"
```

---

## Self-review checklist

- [ ] **Spec coverage:** Every section of the design doc has at least one implementing task.
- [ ] **Placeholder scan:** No `TBD`, `TODO`, or vague steps remain.
- [ ] **Type consistency:** `CreateWorkflowRequest`, `SendWorkflowRequest`, `WaitForWorkflowRequest` match across files.
- [ ] **API consistency:** Restate ingress paths use `/workflow/${instanceId}/{create|send|subscribe|waitFor|snapshot}` everywhere.
- [ ] **Deletion cleanup:** Old approval files are removed and imports updated.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-15-workflow-runtime-snapshot-persistence.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach do you want?
