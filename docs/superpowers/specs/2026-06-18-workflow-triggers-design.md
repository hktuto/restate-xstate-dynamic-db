---
title: Workflow Triggers Design
type: note
status: in-progress
area: docs
created: 2026-06-18
updated: 2026-06-18
related:
  - [[50-Features/Workflow Designer]]
  - [[50-Features/Workflow Engine]]
  - [[50-Features/Workflow Actions Catalog]]
  - [[40-Packages/workflow-actions]]
  - [[40-Packages/workflow-editor-layer]]
  - [[40-Packages/db]]
  - [[30-Apps/web]]
  - [[30-Apps/Admin App/Overview]]
  - [[20-Architecture/Workflow Runtime]]
---

# Workflow Triggers Design

This note extends the workflow system so a workflow can be started by more than just a database CRUD event. The first new trigger type is a **user trigger**: a logged-in user clicks a button, fills in a form generated from the workflow's first action, and starts a workflow instance.

## Goal

- Add a `type` discriminator to the existing `triggers` table.
- Support `db_trigger` (current behavior) and `user_trigger` now.
- Leave a clear place for `cron` and `webhook` trigger types later.
- Let the first action of a workflow declare its required inputs so a user-trigger start form can be generated automatically.
- Keep the workflow runtime and editor model unchanged; only trigger dispatch and the trigger UI/CLI differ.

## Non-goals

- Implement cron scheduling or webhook ingress in this iteration.
- Implement permission rules for user triggers (any logged-in tenant user may trigger for now).
- Build a visual trigger editor inside the workflow canvas; triggers stay on their own pages.
- Change the core `WorkflowDefinition` shape produced by the editor.

## Context

Currently the only way to start a workflow is a DB CRUD trigger:

- `packages/db/src/schema-definitions.ts` defines `triggers` with `tableName`, `event`, `workflowId`.
- `apps/api/src/lib/dispatch.ts` listens to record changes and calls Restate ingress `/workflow/{instanceId}/create`.
- `apps/api/src/routes/triggers.ts` lets tenant admins create these triggers.
- `packages/workflow-actions/src/catalog/actions.ts` declares action params, but nothing declares "inputs that must come from the trigger context."

The runtime expects every start request to include a `record` object with at least an `id`:

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
```

A user trigger must satisfy this contract by building a synthetic `record` from the values the user submits.

## Decisions

1. **Unified workflow and trigger model.** One `workflows` table, one `triggers` table, one runtime path. The trigger row stores `type` and type-specific `options`.
2. **Action catalog declares required inputs.** `ActionMetadata` gains an optional `inputs` map. The key is the context path (e.g. `record.id`, `record.name`). The UI/runtime use this to build a start form.
3. **User-trigger start form is derived from the first action.** When a user triggers a workflow, the system reads the first state, finds its action metadata, and renders inputs for every required input that is not already provided by the trigger mechanism.
4. **Synthetic record for user triggers.** The submitted values are placed under a synthetic `record` object with `id` set to the new `workflow_instances` id. This keeps the existing runtime contract intact.
5. **Permissions deferred.** User triggers are open to any logged-in tenant user in this iteration. The `user_trigger` options object reserves a `permissions` field for later enforcement.

## Data model changes

### `triggers` table

Add two columns:

- `type`: `string` (select: `db_trigger`, `user_trigger`, `cron`, `webhook`)
- `options`: `object`

Existing rows are treated as `type = 'db_trigger'` and `options = { tableName, event }`. A migration can backfill this.

`options` shapes:

| Type | Options shape |
|---|---|
| `db_trigger` | `{ tableName: string, event: 'insert' \| 'update' \| 'delete', condition?: unknown }` |
| `user_trigger` | `{ permissions?: string[] }` (empty for now) |
| `cron` | `{ schedule: string }` (future) |
| `webhook` | `{ path?: string, secret?: string }` (future) |

### `workflow_instances` table

Add an optional `triggerId` relation. Existing DB-triggered instances leave it empty. User-triggered instances point to the trigger that started them.

```ts
export interface WorkflowInstanceInput {
  workflowId: string
  triggerId?: string
  tableName: string
  recordId: string
  namespace: string
  companyId?: string
  status?: WorkflowInstanceStatus
  context?: Record<string, unknown>
}
```

### Action metadata

Extend `ActionMetadata` in `packages/shared/src/index.ts`:

```ts
export interface ActionInputMetadata {
  type: 'string' | 'number' | 'boolean' | 'record' | 'json'
  label: string
  description?: string
  required?: boolean
  default?: unknown
}

export interface ActionMetadata {
  id: string
  label: string
  description?: string
  category?: string
  paramsSchema?: Record<string, ParamSchema>
  inputs?: Record<string, ActionInputMetadata>
}
```

Keys are context paths. For the first iteration, only `record.<field>` paths are supported. Example:

```ts
{
  id: 'createRecord',
  inputs: {
    'record.name': { type: 'string', label: 'Name', required: true },
    'record.status': { type: 'string', label: 'Status', default: 'active' }
  }
}
```

## API changes

### Trigger routes

`apps/api/src/routes/triggers.ts` (and the platform admin equivalent) accept:

```ts
{
  type: 'db_trigger' | 'user_trigger' | 'cron'
  workflowId: string
  options: Record<string, unknown>
}
```

Validation:

- `type` is required.
- `db_trigger` options must include `tableName` and `event`.
- `user_trigger` options may be empty.
- `cron` options must include `schedule` (but the runtime path is not implemented yet).

### New workflow-instance route

`POST /api/workflow-instances` starts a user-triggered instance:

```ts
{
  workflowId: string
  values: Record<string, unknown>
}
```

Behavior:

1. Look up the workflow and an active `user_trigger` for it.
2. Build a synthetic record: `{ id: <new instance id>, ...values }`.
3. Create a `workflow_instances` row with `tableName = '_user_trigger'` and `recordId = instance.id`.
4. Call Restate ingress `/workflow/{instanceId}/create` with the full `CreateWorkflowRequest`.

A matching admin route `POST /api/admin/workflow-instances` handles platform workflows.

## Dispatch changes

`apps/api/src/lib/dispatch.ts` keeps the DB-trigger path unchanged, but only matches triggers whose `type === 'db_trigger'` and whose `options.tableName`/`options.event` match the CRUD event.

A new helper `dispatchUserTrigger(namespace, workflowId, values, { companyId })` performs the steps described above. It is called from the new `POST /api/workflow-instances` route, not from DB CRUD hooks.

## UI changes

### Trigger list / create page

- Add a "Trigger type" selector.
- For `db_trigger`, show the existing `tableName`/`event` form.
- For `user_trigger`, show a minimal form (workflow only; permissions hidden/placeholder).

### Workflow list / detail page

- For workflows that have a `user_trigger`, show a **Run** button.
- Clicking it opens a modal whose form is generated from the first action's `inputs` metadata.
- On submit, call `POST /api/workflow-instances` and show success/error feedback.

### Admin app

Mirror the same pages for platform workflows under `/admin/workflows`.

## Runtime impact

No runtime changes are required if the synthetic record satisfies the `CreateWorkflowRequest` contract. The first action receives `context.record` as usual.

If the first action's inputs are missing or the user submits an invalid value, the runtime action executor will fail normally and the instance will move to an error state. A future iteration can add client-side form validation from `ActionInputMetadata`.

## Backwards compatibility

- Existing `triggers` rows keep working because the read path treats missing `type` as `db_trigger` and missing `options` as `{ tableName, event }`.
- The create/update API accepts the new shape; old clients that send `{ tableName, event, workflowId }` can be supported by inferring `type = 'db_trigger'` and `options = { tableName, event }`.
- After a migration window, `triggers.tableName` and `triggers.event` can be removed from the schema.

## Security / permissions

- `tenantAuth` and `adminAuth` middleware continue to guard routes.
- `db_trigger` creation stays restricted to `owner`/`admin`.
- `user_trigger` execution is open to any authenticated tenant member in this iteration. The reserved `options.permissions` field will later support role-based gating.

## Testing approach

- **Unit tests:** trigger option validation, synthetic record building, action input extraction.
- **API tests:** create `user_trigger`, call `POST /api/workflow-instances`, assert instance created and Restate ingress called with correct payload.
- **Runtime round-trip:** use the existing `apps/workflow-runtime/tests/runtime.test.ts` pattern to start a user-triggered workflow and confirm the first action receives the submitted record.
- **Typecheck:** all modified apps and packages pass `nuxt typecheck` / `tsc`.

## Risks

| Risk | Mitigation |
|---|---|
| Synthetic `record` confuses actions that expect a real DB record | Document that user-triggered workflows should use actions that operate on submitted values or create records themselves. |
| First action has no `inputs` metadata | Start form is empty; workflow starts with `{ id: instanceId }`. This is valid but limited. |
| Existing trigger rows lack `type`/`options` | Backfill migration and defensive read-path inference. |

## Open questions

1. Should the start form validate types client-side using `ActionInputMetadata.type`?
2. Should `workflow_instances` store the submitted `values` separately from the synthetic record for audit purposes?
3. Should user-triggered workflows support multiple active instances per workflow, or only one at a time?
