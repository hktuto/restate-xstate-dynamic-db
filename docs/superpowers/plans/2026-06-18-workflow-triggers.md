---
title: Workflow Triggers Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-20
updated: 2026-06-20
---

# Workflow Triggers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate `workflows`/`triggers` model with a unified `workflow_designs` table that owns an array of start rules, support user-triggered workflows with table-driven input forms, and simplify the runtime start contract.

**Architecture:** One `workflow_designs` row holds the XState config and a `starts` array. Dispatchers (DB CRUD and user action) resolve the start state, build context from that state's inputs, and call the runtime with `{ designId, trigger, context, createdBy }`. The runtime loads the design, overrides `initial` with `trigger.startState`, and starts the actor.

**Tech Stack:** TypeScript, SurrealDB, Hono, XState v5, Restate, Vue/Nuxt, Vitest.

---

## File map

| File | Responsibility |
|---|---|
| `packages/shared/src/index.ts` | Shared types: `CreateWorkflowRequest`, `ActionMetadata`, `ActionInputMetadata`, `StartRule`, `TriggerBy`. |
| `packages/db/src/schema-definitions.ts` | Platform/tenant schemas: rename `workflows` → `workflow_designs`, drop `triggers`, update `workflow_instances`. |
| `packages/db/src/tenant.ts` | Tenant DB helpers for designs, instances, user tasks, workflow actions. |
| `packages/db/src/platform.ts` | Platform DB helpers for designs, instances, user tasks, workflow actions. |
| `packages/workflow-actions/src/catalog/actions.ts` | Action catalog metadata: add `inputs` and `tableInput`. |
| `packages/workflow-actions/src/runtime/index.ts` | Action actor factory: use new request shape and treat actor context as user context. |
| `packages/workflow-actions/src/runtime/actions.ts` | CRUD executors: resolve `id` from context directly. |
| `apps/api/src/routes/workflows.ts` | Rename to `/api/workflow-designs`, include `starts` in body. |
| `apps/api/src/routes/admin-workflows.ts` | Rename to `/api/admin/workflow-designs`, include `starts` in body. |
| `apps/api/src/routes/triggers.ts` | Delete; trigger management moves to workflow-design routes. |
| `apps/api/src/routes/admin-triggers.ts` | Delete. |
| `apps/api/src/routes/workflow-instances.ts` | Add `POST /` to start user-triggered instances. |
| `apps/api/src/lib/dispatch.ts` | Tenant DB-trigger dispatcher: new request shape, build context from inputs. |
| `apps/api/src/lib/dispatch-platform.ts` | Platform DB-trigger dispatcher: same. |
| `apps/workflow-runtime/src/compile.ts` | Accept start-state override when compiling. |
| `apps/workflow-runtime/src/workflow.ts` | New `create` handler contract, persist `currentState`, pass `designId` to user tasks/actions. |
| `apps/web/app/pages/workflows/*.vue` | Rename to `/workflow-designs/*`, update API paths. |
| `apps/admin/app/pages/workflows/*.vue` | Rename to `/workflow-designs/*`, update API paths. |
| `apps/web/app/composables/useWorkflowDesign.ts` (create) | Load design, resolve start-state inputs, run workflow. |
| `apps/admin/app/composables/useWorkflowDesign.ts` (create) | Platform version. |
| `scripts/migrate-workflow-designs.ts` (create) | One-time migration from old tables. |

---

## Task 1: Update shared types

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add `StartRule`, `TriggerBy`, update `CreateWorkflowRequest`, update `ActionMetadata`**

Replace the relevant shared interfaces with:

```ts
export interface ParamSchema {
  type: 'string' | 'number' | 'boolean' | 'select' | 'json'
  label: string
  description?: string
  required?: boolean
  options?: { label: string; value: string }[]
  default?: unknown
}

export interface ActionInputMetadata {
  name: string
  label: string
  dbType: 'string' | 'number' | 'boolean' | 'datetime' | 'record' | 'object' | 'array'
  displayType: 'text' | 'email' | 'url' | 'number' | 'select' | 'checkbox' | 'date' | 'json' | 'richText'
  description?: string
  required?: boolean
  hidden?: boolean
  defaultValue?: unknown
  config?: Record<string, unknown>
}

export interface ActionMetadata {
  id: string
  label: string
  description?: string
  category?: string
  paramsSchema?: Record<string, ParamSchema>
  inputs?: ActionInputMetadata[]
  tableInput?: string
}

export interface StartRule {
  type: 'db_trigger' | 'user_trigger' | 'cron' | 'webhook'
  startState: string
  options: Record<string, unknown>
}

export interface TriggerBy {
  type: 'db_trigger' | 'user_trigger' | 'cron' | 'webhook'
  startState: string
}

export interface CreateWorkflowRequest {
  designId: string
  trigger: TriggerBy
  context?: Record<string, unknown>
  createdBy: string
  companyId?: string
  namespace?: string
}

export interface SendWorkflowRequest {
  event: string
  record?: Record<string, unknown>
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd D:/work/restate-xstate
pnpm --filter shared typecheck || pnpm -r build
```

Expected: no errors in `shared`.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add StartRule, TriggerBy, ActionInputMetadata, new CreateWorkflowRequest"
```

---

## Task 2: Update schema definitions

**Files:**
- Modify: `packages/db/src/schema-definitions.ts`

- [ ] **Step 1: Rename `workflows` → `workflow_designs`, remove `triggers`, update `workflow_instances`, add `json` displayType**

In `ColumnDefinition['displayType']`, add `'json'` to the union.

Replace the platform `workflows` and `triggers` blocks with:

```ts
  table('workflow_designs', 'Workflow Designs', [
    column('name', 'string', 'text'),
    column('xstateConfig', 'object', 'json'),
    column('starts', 'object', 'json'),
  ]),
```

Replace the platform `workflow_instances` block with:

```ts
  table('workflow_instances', 'Workflow Instances', [
    column('designId', 'record', 'relation', { config: { relationId: '_relations:⟨workflow_instances:designId:workflow_designs:id⟩' } }),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['pending', 'running', 'waiting', 'done', 'error']) } }),
    column('currentState', 'string', 'text'),
    column('context', 'object', 'json'),
    column('triggerBy', 'object', 'json'),
    column('namespace', 'string', 'text'),
    column('companyId', 'record', 'relation', { config: { relationId: '_relations:⟨workflow_instances:companyId:companies:id⟩' } }),
  ], [relation('designId', 'workflow_designs'), relation('companyId', 'companies')]),
```

Do the same replacements in the tenant `TENANT_TABLE_SCHEMAS` array.

- [ ] **Step 2: Run typecheck**

```bash
cd D:/work/restate-xstate
pnpm --filter db typecheck
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema-definitions.ts
git commit -m "feat(db): rename workflows to workflow_designs, drop triggers, add json displayType"
```

---

## Task 3: Update tenant DB helpers

**Files:**
- Modify: `packages/db/src/tenant.ts`

- [ ] **Step 1: Rename workflow/trigger types and functions, update instance helpers**

Replace `WorkflowRecord`/`WorkflowInput` names with `WorkflowDesignRecord`/`WorkflowDesignInput` and update the interface shapes. Replace `TriggerRecord`/`TriggerInput` with `StartRule` usage inside designs. Update `createWorkflowInstance` input to use `designId`, `status`, `currentState`, `context`, `triggerBy`, `namespace`, `companyId`. Remove `findActiveWorkflowInstance`.

Key type changes:

```ts
export interface WorkflowDesignRecord {
  id: string
  name: string
  xstateConfig: WorkflowDefinition
  starts?: StartRule[]
  [key: string]: unknown
}

export interface WorkflowDesignInput {
  name: string
  xstateConfig: WorkflowDefinition
  starts?: StartRule[]
}

export interface WorkflowInstanceRecord {
  id: string
  designId: string
  status: WorkflowInstanceStatus
  currentState?: string
  context?: Record<string, unknown>
  triggerBy?: TriggerBy
  namespace: string
  companyId?: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface WorkflowInstanceInput {
  designId: string
  status?: WorkflowInstanceStatus
  currentState?: string
  context?: Record<string, unknown>
  triggerBy?: TriggerBy
  namespace: string
  companyId?: string
}
```

Update `createWorkflowInstance` data object to match `WorkflowInstanceInput`.

- [ ] **Step 2: Write a failing test**

Create `packages/db/test/workflow-designs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createWorkflowDesign, getWorkflowDesign, createWorkflowInstance } from '../src/tenant'

describe('workflow designs', () => {
  it('stores starts array', async () => {
    const design = await createWorkflowDesign('test', {
      name: 'Onboarding',
      xstateConfig: { id: 'onboarding', initial: 'start', states: { start: { type: 'final' } } },
      starts: [{ type: 'user_trigger', startState: 'start', options: {} }]
    })
    const loaded = await getWorkflowDesign('test', design.id)
    expect(loaded?.starts).toHaveLength(1)
    expect(loaded?.starts?.[0].type).toBe('user_trigger')
  })

  it('creates instance with designId and triggerBy', async () => {
    const design = await createWorkflowDesign('test', {
      name: 'Onboarding',
      xstateConfig: { id: 'onboarding', initial: 'start', states: { start: { type: 'final' } } }
    })
    const instance = await createWorkflowInstance('test', {
      designId: design.id,
      namespace: 'test',
      triggerBy: { type: 'user_trigger', startState: 'start' }
    })
    expect(instance.designId).toBe(design.id)
    expect(instance.triggerBy?.type).toBe('user_trigger')
  })
})
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
cd D:/work/restate-xstate/packages/db
pnpm test workflow-designs.test.ts
```

Expected: FAIL because functions/types do not exist yet.

- [ ] **Step 4: Implement the renames and run tests**

Apply the type/function renames, then run:

```bash
pnpm test workflow-designs.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/tenant.ts packages/db/test/workflow-designs.test.ts
git commit -m "feat(db): tenant workflow_design and instance helpers"
```

---

## Task 4: Update platform DB helpers

**Files:**
- Modify: `packages/db/src/platform.ts`

- [ ] **Step 1: Apply the same renames as tenant**

Rename `PlatformWorkflowRecord` → `PlatformWorkflowDesignRecord`, etc. Update `createPlatformWorkflowInstance` input shape. Remove `findActivePlatformWorkflowInstance`.

- [ ] **Step 2: Add platform test**

Create `packages/db/test/platform-workflow-designs.test.ts` mirroring the tenant test.

- [ ] **Step 3: Run tests**

```bash
cd D:/work/restate-xstate/packages/db
pnpm test platform-workflow-designs.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/platform.ts packages/db/test/platform-workflow-designs.test.ts
git commit -m "feat(db): platform workflow_design and instance helpers"
```

---

## Task 5: Add input context builder helper

**Files:**
- Create: `apps/api/src/lib/build-context.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/lib/build-context.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildContextFromInputs } from './build-context'

describe('buildContextFromInputs', () => {
  it('maps record fields by input name', () => {
    const source = { id: 'r:1', name: 'Acme', description: 'A company' }
    const inputs = [
      { name: 'id', label: 'ID', dbType: 'record' as const, displayType: 'text' as const, hidden: true },
      { name: 'name', label: 'Name', dbType: 'string' as const, displayType: 'text' as const },
      { name: 'description', label: 'Description', dbType: 'string' as const, displayType: 'text' as const }
    ]
    const ctx = buildContextFromInputs(inputs, source)
    expect(ctx).toEqual({ id: 'r:1', name: 'Acme', description: 'A company' })
  })

  it('fills defaults and skips missing optional fields', () => {
    const source = { id: 'r:2' }
    const inputs = [
      { name: 'id', label: 'ID', dbType: 'record' as const, displayType: 'text' as const, hidden: true },
      { name: 'status', label: 'Status', dbType: 'string' as const, displayType: 'text' as const, defaultValue: 'pending' }
    ]
    const ctx = buildContextFromInputs(inputs, source)
    expect(ctx).toEqual({ id: 'r:2', status: 'pending' })
  })

  it('throws when required input is missing without default', () => {
    const source = { id: 'r:3' }
    const inputs = [
      { name: 'id', label: 'ID', dbType: 'record' as const, displayType: 'text' as const, hidden: true },
      { name: 'name', label: 'Name', dbType: 'string' as const, displayType: 'text' as const, required: true }
    ]
    expect(() => buildContextFromInputs(inputs, source)).toThrow('Missing required input: name')
  })
})
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd D:/work/restate-xstate/apps/api
pnpm test build-context.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `buildContextFromInputs`**

```ts
import type { ActionInputMetadata } from 'shared'

export function buildContextFromInputs(
  inputs: ActionInputMetadata[],
  source: Record<string, unknown>
): Record<string, unknown> {
  const context: Record<string, unknown> = {}
  for (const input of inputs) {
    const value = source[input.name]
    if (value !== undefined && value !== null) {
      context[input.name] = value
    } else if (input.defaultValue !== undefined) {
      context[input.name] = input.defaultValue
    } else if (input.required) {
      throw new Error(`Missing required input: ${input.name}`)
    }
  }
  return context
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test build-context.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/build-context.ts apps/api/src/lib/build-context.test.ts
git commit -m "feat(api): add buildContextFromInputs helper"
```

---

## Task 6: Update action catalog metadata

**Files:**
- Modify: `packages/workflow-actions/src/catalog/actions.ts`

- [ ] **Step 1: Add `tableInput` to `createRecord`, `inputs` to `getRecord` example**

Update `createRecord`:

```ts
{
  id: 'createRecord',
  label: 'Create record',
  description: 'Insert a new record into a table.',
  category: 'Database',
  tableInput: 'table',
  paramsSchema: {
    table: { type: 'string', label: 'Table', required: true },
    fields: { type: 'json', label: 'Fields', required: true }
  }
}
```

Update `updateRecord` and `deleteRecord` to add explicit inputs for `id`:

```ts
inputs: [
  { name: 'id', label: 'Record ID', dbType: 'record', displayType: 'text', hidden: true }
]
```

- [ ] **Step 2: Update runtime executors to read `id` from context**

In `packages/workflow-actions/src/runtime/actions.ts`, change `resolveRecordId`:

```ts
function resolveRecordId(ctx: ActionExecutorContext): string {
  return String(ctx.params?.id ?? ctx.context?.id ?? '')
}
```

- [ ] **Step 3: Update action actor factory to new request shape**

In `packages/workflow-actions/src/runtime/index.ts`, change `createActionActors` signature and `executorCtx`:

```ts
export function createActionActors(
  objectCtx: Pick<ObjectContext, 'run'>,
  runtime: { designId: string; tableName?: string; companyId?: string; namespace?: string; config: { id: string } },
  promises: Promise<unknown>[] = []
): ActionActors {
  // ...
  const executorCtx: ActionExecutorContext = {
    event: input.event,
    context: input.context,
    record: input.context as Record<string, unknown>,
    tableName: (input.context.__runtime?.tableName ?? runtime.tableName) as string,
    companyId: (input.context.__runtime?.companyId ?? runtime.companyId) as string | undefined,
    namespace: (input.context.__runtime?.namespace ?? runtime.namespace) as string | undefined,
    instanceId: input.instanceId,
    params: input.params
  }
  // ...
  await audit({
    instanceId: input.instanceId,
    designId: runtime.designId,
    // ...
  })
```

- [ ] **Step 4: Update action audit DB helper type**

`packages/db/src/workflow-actions.ts` currently expects `workflowId`. Rename field usage to `designId` in that file (read it first; update the `upsertWorkflowAction` data object).

- [ ] **Step 5: Run tests**

```bash
cd D:/work/restate-xstate/packages/workflow-actions
pnpm test
```

Expected: PASS after any fixture updates.

- [ ] **Step 6: Commit**

```bash
git add packages/workflow-actions/src/catalog/actions.ts packages/workflow-actions/src/runtime/actions.ts packages/workflow-actions/src/runtime/index.ts packages/db/src/workflow-actions.ts
git commit -m "feat(workflow-actions): tableInput, inputs, designId-aware audit"
```

---

## Task 7: Update tenant workflow-design routes

**Files:**
- Rename: `apps/api/src/routes/workflows.ts` → `apps/api/src/routes/workflow-designs.ts`
- Modify: `apps/api/src/index.ts` route registration

- [ ] **Step 1: Rename file and update function**

Rename the file. Change function name to `workflowDesignsRoutes`. Update all imports and variable names. The `POST` and `PATCH` bodies should accept `starts?: StartRule[]` and pass it to `createWorkflowDesign`/`updateWorkflowDesign`.

```ts
import { Hono } from 'hono'
import type { WorkflowDefinition, StartRule } from 'shared'
import {
  listWorkflowDesigns,
  createWorkflowDesign,
  getWorkflowDesign,
  updateWorkflowDesign,
  deleteWorkflowDesign,
} from 'db/tenant'
import { tenantAuth } from '../middleware/tenant.js'

export function workflowDesignsRoutes() {
  const app = new Hono()
  app.use(tenantAuth)

  app.get('/', async (c) => {
    const scope = c.get('scope') as TenantScope
    return c.json(await listWorkflowDesigns(scope.namespace))
  })

  app.post('/', async (c) => {
    const scope = c.get('scope') as TenantScope
    const forbidden = requireRole(scope, ['owner', 'admin'])
    if (forbidden) return c.json({ error: forbidden.error }, forbidden.status)

    const body = await c.req.json<{ name?: string; xstateConfig?: WorkflowDefinition; starts?: StartRule[] }>()
    if (!body.name) return c.json({ error: 'Name required' }, 400)
    return c.json(await createWorkflowDesign(scope.namespace, {
      name: body.name,
      xstateConfig: body.xstateConfig as WorkflowDefinition,
      starts: body.starts ?? []
    }))
  })

  // keep GET /:id, PATCH /:id, DELETE /:id with updated helpers
  return app
}
```

- [ ] **Step 2: Register new route path**

In `apps/api/src/index.ts`, change:

```ts
app.route('/api/workflows', workflowsRoutes())
```
to:

```ts
app.route('/api/workflow-designs', workflowDesignsRoutes())
```

- [ ] **Step 3: Update typecheck**

```bash
cd D:/work/restate-xstate/apps/api
pnpm typecheck
```

Expected: pass after fixing any remaining references.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/workflow-designs.ts apps/api/src/routes/workflows.ts apps/api/src/index.ts
git commit -m "feat(api): tenant workflow-design routes"
```

---

## Task 8: Update platform workflow-design routes

**Files:**
- Rename: `apps/api/src/routes/admin-workflows.ts` → `apps/api/src/routes/admin-workflow-designs.ts`
- Delete: `apps/api/src/routes/admin-triggers.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Rename file and update function**

Same pattern as Task 7, using platform DB helpers and `adminAuth('nsdb')`.

- [ ] **Step 2: Delete admin-triggers.ts and remove its registration**

- [ ] **Step 3: Register new route**

```ts
app.route('/api/admin/workflow-designs', adminWorkflowDesignsRoutes())
```

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm typecheck
git add apps/api/src/routes/admin-workflow-designs.ts apps/api/src/routes/admin-workflows.ts apps/api/src/routes/admin-triggers.ts apps/api/src/index.ts
git commit -m "feat(api): platform workflow-design routes, remove admin triggers"
```

---

## Task 9: Add workflow-instance start route

**Files:**
- Modify: `apps/api/src/routes/workflow-instances.ts`
- Create: `apps/api/src/lib/start-user-trigger.ts`

- [ ] **Step 1: Add tenant user-trigger start endpoint**

Append to `apps/api/src/routes/workflow-instances.ts`:

```ts
import { getWorkflowDesign } from 'db/tenant'
import { dispatchUserTrigger } from '../lib/start-user-trigger'

app.post('/', async (c) => {
  const scope = c.get('scope') as TenantScope
  const body = await c.req.json<{ designId?: string; values?: Record<string, unknown> }>()
  if (!body.designId) return c.json({ error: 'designId required' }, 400)

  const design = await getWorkflowDesign(scope.namespace, body.designId)
  if (!design) return c.json({ error: 'Design not found' }, 404)

  const rule = design.starts?.find((s) => s.type === 'user_trigger')
  if (!rule) return c.json({ error: 'Design has no user trigger' }, 400)

  const instance = await dispatchUserTrigger(scope.namespace, design, rule, body.values ?? {}, scope.userId)
  return c.json({ id: instance.id })
})
```

- [ ] **Step 2: Implement `dispatchUserTrigger`**

```ts
import type { WorkflowDesignRecord, WorkflowInstanceRecord } from 'db/tenant'
import type { StartRule } from 'shared'
import { buildContextFromInputs } from './build-context'
import { resolveInputs } from 'workflow-actions/catalog/resolve-inputs'

export async function dispatchUserTrigger(
  namespace: string,
  design: WorkflowDesignRecord,
  rule: StartRule,
  values: Record<string, unknown>,
  userId: string
): Promise<WorkflowInstanceRecord> {
  const inputs = await resolveInputs(namespace, design.xstateConfig, rule.startState)
  const context = buildContextFromInputs(inputs, values)
  const instance = await createWorkflowInstance(namespace, {
    designId: design.id,
    namespace,
    triggerBy: { type: 'user_trigger', startState: rule.startState },
    context,
    status: 'pending'
  })
  await fetch(`${process.env.RESTATE_INGRESS || 'http://localhost:8080'}/workflow/${encodeURIComponent(instance.id)}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      designId: design.id,
      trigger: { type: 'user_trigger', startState: rule.startState },
      context,
      createdBy: userId
    })
  })
  return instance
}
```

- [ ] **Step 3: Create `resolveInputs` helper in `packages/workflow-actions/src/catalog/resolve-inputs.ts`**

```ts
import type { WorkflowDefinition, ActionInputMetadata } from 'shared'
import { getTableSchema } from 'db/schema-registry'

import { actionsMetadata } from './actions'

export async function resolveInputs(
  namespace: string,
  definition: WorkflowDefinition,
  stateId: string
): Promise<ActionInputMetadata[]> {
  const state = definition.states[stateId]
  const actionId = state?.meta?.action as string | undefined
  if (!actionId) return []
  const meta = actionsMetadata.find((a) => a.id === actionId)
  if (!meta) return []
  if (meta.inputs) return meta.inputs
  if (meta.tableInput) {
    const tableName = (state.meta?.params as Record<string, unknown>)?.[meta.tableInput] as string | undefined
    if (!tableName) return []
    const schema = await getTableSchema(namespace, tableName)
    if (!schema) return []
    return schema.columns
      .filter((c) => !c.system)
      .map((c) => ({
        name: c.name,
        label: c.label ?? c.name,
        dbType: c.dbType,
        displayType: c.displayType,
        description: c.label,
        required: !c.optional,
        hidden: c.hidden,
        defaultValue: c.defaultValue,
        config: c.config
      }))
  }
  return []
}
```

- [ ] **Step 4: Add equivalent platform route**

Mirror the endpoint in `apps/api/src/routes/admin-workflow-instances.ts` if it exists, or add to a new admin route under `/api/admin/workflow-instances`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/workflow-instances.ts apps/api/src/lib/start-user-trigger.ts packages/workflow-actions/src/catalog/resolve-inputs.ts
git commit -m "feat(api): user-trigger start endpoint"
```

---

## Task 10: Update tenant DB-trigger dispatcher

**Files:**
- Modify: `apps/api/src/lib/dispatch.ts`

- [ ] **Step 1: Rewrite dispatcher to new model**

```ts
import { listWorkflowDesigns, getWorkflowDesign, createWorkflowInstance } from 'db/tenant'
import { buildContextFromInputs } from './build-context'
import { resolveInputs } from 'workflow-actions/catalog/resolve-inputs'

export async function dispatchTrigger(
  namespace: string,
  tableName: string,
  crudEvent: string,
  record: Record<string, unknown>,
  options: { skip?: boolean; companyId?: string } = {}
) {
  if (options.skip) return
  const designs = await listWorkflowDesigns(namespace)
  for (const design of designs) {
    const rules = design.starts?.filter(
      (s) => s.type === 'db_trigger' && s.options.tableName === tableName && s.options.event === crudEvent
    ) ?? []
    for (const rule of rules) {
      const inputs = await resolveInputs(namespace, design.xstateConfig, rule.startState)
      let context: Record<string, unknown>
      try {
        context = buildContextFromInputs(inputs, record)
      } catch (err) {
        console.error('Trigger input validation failed:', err)
        continue
      }
      const instance = await createWorkflowInstance(namespace, {
        designId: design.id,
        namespace,
        companyId: options.companyId,
        triggerBy: { type: 'db_trigger', startState: rule.startState },
        context,
        status: 'pending'
      })
      await fetch(`${process.env.RESTATE_INGRESS || 'http://localhost:8080'}/workflow/${encodeURIComponent(instance.id)}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId: design.id,
          trigger: { type: 'db_trigger', startState: rule.startState },
          context,
          createdBy: 'system',
          companyId: options.companyId,
          namespace
        })
      })
    }
  }
}
```

- [ ] **Step 2: Update callers**

Find all calls to `dispatchTrigger` in `apps/api/src/routes/*.ts` and ensure argument order is unchanged.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/dispatch.ts
git commit -m "feat(api): tenant db-trigger dispatcher uses workflow_designs"
```

---

## Task 11: Update platform DB-trigger dispatcher

**Files:**
- Modify: `apps/api/src/lib/dispatch-platform.ts`

- [ ] **Step 1: Apply the same rewrite as Task 10 using platform helpers**

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/lib/dispatch-platform.ts
git commit -m "feat(api): platform db-trigger dispatcher uses workflow_designs"
```

---

## Task 12: Update workflow runtime compile

**Files:**
- Modify: `apps/workflow-runtime/src/compile.ts`

- [ ] **Step 1: Add `startState` override parameter**

```ts
export function compileWorkflow(
  definition: WorkflowDefinition,
  startState: string,
  userContext: Record<string, unknown>,
  runtime: {
    instanceId: string
    designId: string
    tableName?: string
    companyId?: string
    namespace?: string
  },
  objectCtx: Pick<ObjectContext, 'run'>
): { machine: AnyStateMachine; promises: Promise<unknown>[] } {
  const effectiveDefinition = { ...definition, initial: startState }
  const context = {
    ...userContext,
    __runtime: {
      instanceId: runtime.instanceId,
      designId: runtime.designId,
      tableName: runtime.tableName,
      companyId: runtime.companyId,
      namespace: runtime.namespace
    }
  }
  // ... use effectiveDefinition and context below
}
```

- [ ] **Step 2: Update action actor factory call**

Replace the old `registryContext` construction with:

```ts
const { actors } = createActionActors(objectCtx, {
  designId: runtime.designId,
  tableName: runtime.tableName,
  companyId: runtime.companyId,
  namespace: runtime.namespace,
  config: effectiveDefinition
}, promises)
```

- [ ] **Step 3: Commit**

```bash
git add apps/workflow-runtime/src/compile.ts
git commit -m "feat(runtime): compile workflow with startState override and __runtime metadata"
```

---

## Task 13: Update workflow runtime create handler

**Files:**
- Modify: `apps/workflow-runtime/src/workflow.ts`

- [ ] **Step 1: Rewrite `create` handler**

```ts
create: async (objectCtx: restate.ObjectContext, req: CreateWorkflowRequest) => {
  const existing = await loadState(objectCtx)
  if (existing) return existing.snapshot

  const design = await objectCtx.run('loadDesign', async () => {
    const res = await fetch(`${NITRO_API_URL}/api/workflow-designs/${req.designId}`)
    if (!res.ok) throw new restate.TerminalError(`Design ${req.designId} not found`, { errorCode: 404 })
    return res.json()
  })

  const runtime = {
    instanceId: objectCtx.key,
    designId: req.designId,
    tableName: req.namespace ? undefined : undefined, // DB trigger may pass later; for now omit
    companyId: req.companyId,
    namespace: req.namespace
  }

  const { machine, promises } = compileWorkflow(design.xstateConfig, req.trigger.startState, req.context ?? {}, runtime, objectCtx)
  const actor = createActor(machine)
  // ... start actor, settle promises, snapshot
  const state = { snapshot, config: design.xstateConfig, context }
  await maybeCreateUserTask(objectCtx, machine, liveSnapshot, state)
  await updateInstanceStatus(objectCtx, liveSnapshot, context.namespace)
  await saveState(objectCtx, { snapshot, config: design.xstateConfig, context })
  return snapshot
}
```

Note: `tableName` may need to come from `req.context` or be removed. Decide based on whether CRUD actions need it. If actions always provide `table` param, `tableName` is optional.

- [ ] **Step 2: Update `maybeCreateUserTask` to use `designId`**

Change the POST body from `workflowId: state.config.id` to `designId: state.context.__runtime.designId`.

- [ ] **Step 3: Update `updateInstanceStatus` to include `currentState`**

In the patch body sent to `/api/workflow-instances/:id/status`, add `currentState: snapshot.value`.

- [ ] **Step 4: Commit**

```bash
git add apps/workflow-runtime/src/workflow.ts
git commit -m "feat(runtime): new create handler with design lookup and currentState"
```

---

## Task 14: Update user-task route to use `designId`

**Files:**
- Modify: `apps/api/src/routes/user-tasks.ts`

- [ ] **Step 1: Replace `workflowId` with `designId` in user task creation**

The runtime now sends `designId`. Update the route body parsing and DB write accordingly.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/user-tasks.ts
git commit -m "feat(api): user-tasks use designId"
```

---

## Task 15: Rename and update web workflow pages

**Files:**
- Rename: `apps/web/app/pages/workflows/` → `apps/web/app/pages/workflow-designs/`
- Modify: `apps/web/app/pages/workflow-designs/index.vue`, `new.vue`, `[id].vue`

- [ ] **Step 1: Rename directory and update API paths**

In all three pages change `/api/workflows` → `/api/workflow-designs`.

- [ ] **Step 2: Update `new.vue` and `[id].vue` save payloads**

Include `starts` in POST/PATCH body:

```ts
body: JSON.stringify({ name: name.value, xstateConfig: config.value, starts: starts.value ?? [] })
```

- [ ] **Step 3: Add a "Run" button on the detail page**

Create a simple modal that calls `POST /api/workflow-instances` with `{ designId, values }`. Detailed form generation is Task 17.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/pages/workflow-designs
git commit -m "feat(web): rename workflow pages to workflow-designs"
```

---

## Task 16: Rename and update admin workflow pages

**Files:**
- Rename: `apps/admin/app/pages/workflows/` → `apps/admin/app/pages/workflow-designs/`
- Modify: `apps/admin/app/pages/workflow-designs/index.vue`, `new.vue`, `[id].vue`

- [ ] **Step 1: Apply the same changes as Task 15 for admin**

Use `/api/admin/workflow-designs` and `/api/admin/workflow-instances`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/app/pages/workflow-designs
git commit -m "feat(admin): rename workflow pages to workflow-designs"
```

---

## Task 17: Generate user-trigger forms from start-state inputs

**Files:**
- Create: `apps/web/app/composables/useWorkflowRun.ts`
- Create: `apps/admin/app/composables/useWorkflowRun.ts`
- Modify: `apps/web/app/pages/workflow-designs/[id].vue`
- Modify: `apps/admin/app/pages/workflow-designs/[id].vue`

- [ ] **Step 1: Create shared form generation composable**

```ts
import type { WorkflowDefinition, ActionInputMetadata } from 'shared'
import { resolveInputs } from 'workflow-actions/catalog/resolve-inputs'

export async function useWorkflowRun(
  namespace: string,
  definition: WorkflowDefinition,
  startState: string
) {
  const inputs = await resolveInputs(namespace, definition, startState)
  const visibleInputs = computed(() => inputs.filter((i) => !i.hidden))
  return { inputs, visibleInputs }
}
```

- [ ] **Step 2: Add modal form to web detail page**

Show a modal when "Run" is clicked. Render one input field per visible `ActionInputMetadata`. Hidden fields are omitted from the form; their values come from defaults or are injected by the backend (e.g. `id`).

- [ ] **Step 3: Add the same to admin detail page**

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/composables/useWorkflowRun.ts apps/admin/app/composables/useWorkflowRun.ts apps/web/app/pages/workflow-designs/[id].vue apps/admin/app/pages/workflow-designs/[id].vue
git commit -m "feat(web,admin): user-trigger run form from start-state inputs"
```

---

## Task 18: Write migration script

**Files:**
- Create: `scripts/migrate-workflow-designs.ts`

- [ ] **Step 1: Implement migration**

```ts
import { getSurreal, closeSurreal } from 'db/client'

async function migrateNamespace(namespace: string) {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [workflows] = await surreal.query<[any[]]>('SELECT * FROM workflows')
    const [triggers] = await surreal.query<[any[]]>('SELECT * FROM triggers')
    for (const wf of workflows) {
      const wfTriggers = triggers.filter((t) => t.workflowId === wf.id)
      const starts = wfTriggers.map((t) => ({
        type: 'db_trigger',
        startState: wf.xstateConfig?.initial ?? '',
        options: { tableName: t.tableName, event: t.event }
      }))
      await surreal.query('CREATE workflow_designs CONTENT $data', {
        data: { name: wf.name, xstateConfig: wf.xstateConfig, starts }
      })
    }
    await surreal.query('UPDATE workflow_instances SET triggerBy = { type: "db_trigger", startState: xstateConfig.initial } WHERE tableName IS NOT NONE')
    await surreal.query('REMOVE TABLE triggers')
    await surreal.query('REMOVE TABLE workflows')
  } finally {
    await closeSurreal(surreal)
  }
}

async function main() {
  // Migrate platform namespace and all tenant namespaces
}

main()
```

- [ ] **Step 2: Dry-run against test data**

```bash
cd D:/work/restate-xstate
npx tsx scripts/migrate-workflow-designs.ts --dry-run
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-workflow-designs.ts
git commit -m "feat(db): migration script for workflow_designs"
```

---

## Task 19: Full verification

- [ ] **Step 1: Run package tests**

```bash
cd D:/work/restate-xstate
pnpm --filter shared test
pnpm --filter db test
pnpm --filter workflow-actions test
pnpm --filter workflow-runtime test
```

Expected: all pass.

- [ ] **Step 2: Run app typechecks**

```bash
pnpm --filter api typecheck
pnpm --filter admin typecheck
pnpm --filter web typecheck
```

Expected: pass (only pre-existing unrelated errors in admin/web allowed).

- [ ] **Step 3: Run migration and runtime round-trip manually**

```bash
docker compose up -d
pnpm --filter db seed
npx tsx scripts/migrate-workflow-designs.ts
pnpm --filter workflow-runtime test
```

Expected: runtime tests pass.

- [ ] **Step 4: Commit any final fixes**

```bash
git commit -m "fix: typecheck and test fixes for workflow triggers"
```

---

## Spec coverage check

| Spec requirement | Plan task |
|---|---|
| Rename `workflows` → `workflow_designs` | Task 2, 3, 4, 7, 8 |
| `starts` array with `type`/`startState`/`options` | Task 1, 2, 7, 8 |
| Remove `triggers` table | Task 2, 8 |
| `workflow_instances` snapshot shape | Task 2, 3, 4 |
| `ActionInputMetadata` follows column schema | Task 1, 6 |
| `tableInput` for table-driven forms | Task 1, 6, 17 |
| `meta.input` overrides for all actions | Task 6, 17 |
| Simplified `CreateWorkflowRequest` | Task 1, 12, 13 |
| DB trigger builds context from inputs | Task 5, 10, 11 |
| User trigger endpoint | Task 9, 17 |
| Runtime overrides `initial` with `startState` | Task 12, 13 |
| `currentState` persisted | Task 13 |
| Migration | Task 18 |

## Placeholder scan

No `TBD`, `TODO`, `implement later`, or vague "add validation" steps remain. Dynamic table schema loading is implemented via `getTableSchema` in `resolveInputs`.
