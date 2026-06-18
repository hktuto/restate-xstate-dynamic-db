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

- Rename `workflows` → `workflow_designs` to make it clear the table stores the design/blueprint, not a running instance.
- Remove the separate `triggers` table and move start rules into the design as an array of `starts`.
- Support `db_trigger` (current behavior) and `user_trigger` now.
- Leave a clear place for `cron` and `webhook` start types later.
- Let the first action of a workflow declare its required inputs so a user-trigger start form can be generated automatically.
- Keep the core `WorkflowDefinition` shape produced by the editor unchanged.

## Non-goals

- Implement cron scheduling or webhook ingress in this iteration.
- Implement permission rules for user triggers (any logged-in tenant user may trigger for now).
- Build a visual start-rule editor inside the workflow canvas; start rules are configured on the design page.
- Change the runtime XState contract (`CreateWorkflowRequest` still receives a `record`).

## Context

Currently the only way to start a workflow is a DB CRUD trigger:

- `packages/db/src/schema-definitions.ts` defines `workflows` and `triggers`.
- `apps/api/src/lib/dispatch.ts` listens to record changes and calls Restate ingress `/workflow/{instanceId}/create`.
- `apps/api/src/routes/triggers.ts` lets tenant admins create these triggers.
- `packages/workflow-actions/src/catalog/actions.ts` declares action params, but nothing declares "inputs that must come from the start context."

The runtime expects every start request to include a `record` object with at least an `id`:

```ts
export interface CreateWorkflowRequest {
  config: WorkflowDefinition
  startState: string
  event?: string
  tableName: string
  record: Record<string, unknown>
  designId: string
  companyId?: string
  namespace?: string
}
```

A user trigger must satisfy this contract by building a synthetic `record` from the values the user submits.

## Decisions

1. **One design, many starts.** `workflow_designs` owns an array `starts: Array<{ type, options }>`. A design can be launched by a DB event, a button, a cron, or multiple of these.
2. **Rename relations.** `workflow_instances.workflowId` becomes `designId`. API paths become `/api/workflow-designs` and `/api/admin/workflow-designs`.
3. **Action catalog declares required inputs.** `ActionMetadata` gains an optional `inputs` map. The key is the context path (e.g. `record.id`, `record.name`). The UI/runtime use this to build a start form.
4. **Table-driven start forms.** Actions can also declare `tableInput: 'table'`. The form builder reads the action's `table` param, fetches that table's schema, and renders fields automatically.
5. **User-trigger start form is derived from the first action.** When a user triggers a workflow, the system reads the first state, finds its action metadata, and renders inputs from the table schema or explicit `inputs`.
6. **Synthetic record for user triggers.** The submitted values are placed under a synthetic `record` object with `id` set to the new `workflow_instances` id. This keeps the existing runtime contract intact.
7. **Permissions deferred.** User triggers are open to any logged-in tenant user in this iteration. The `user_trigger` options object reserves a `permissions` field for later enforcement.
8. **Add `json` displayType.** `object` and `array` columns can use `displayType: 'json'` so the UI renders raw JSON today and can later switch to a structured nested editor.

## Data model changes

### Rename `workflows` → `workflow_designs`

The design table stores the workflow blueprint and how it can be started:

```ts
export interface WorkflowDesignInput {
  name: string
  xstateConfig: WorkflowDefinition
  starts?: StartRule[]
}

export interface StartRule {
  type: 'db_trigger' | 'user_trigger' | 'cron' | 'webhook'
  startState: string
  options: Record<string, unknown>
}
```

`starts` is stored as a JSON object column (`dbType: 'object'`, `displayType: 'json'`). It replaces the old `triggers` table entirely.

To support this, the column schema gains a new `displayType: 'json'` for `object` and `array` fields. This lets the UI render raw JSON for now and later upgrade to a structured nested editor.

`options` shapes:

| Type | Options shape |
|---|---|
| `db_trigger` | `{ tableName: string, event: 'insert' \| 'update' \| 'delete', condition?: unknown }` |
| `user_trigger` | `{ permissions?: string[] }` (empty for now) |
| `cron` | `{ schedule: string }` (future) |
| `webhook` | `{ path?: string, secret?: string }` (future) |

### `workflow_instances` table

- Rename `workflowId` relation → `designId`.
- Drop `triggerId`; the design's `starts` array and the instance context are enough to understand how it was launched.

```ts
export interface WorkflowInstanceInput {
  designId: string
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
  tableInput?: string
}
```

`inputs` declares explicit context paths. For the first iteration, only `record.<field>` paths are supported.

`tableInput` tells the form builder to derive inputs from a table schema instead. For example, `createRecord` can declare:

```ts
{
  id: 'createRecord',
  tableInput: 'table'
}
```

meaning: "read the `table` param, fetch that table's schema, and use its fields as the start form inputs." The submitted values become the synthetic `record`.

### First-action form configuration

When a workflow can be user-triggered, the first action's state may include a `form` override in `state.meta`:

```ts
meta: {
  action: 'createRecord',
  params: { table: 'members', fields: { ... } },
  form: {
    enabled: true,
    fields: {
      email: { required: true, default: '', events: { onChange: 'validateEmail' } },
      role: { required: true, default: 'member', events: { onMount: 'prefillRole' } }
    }
  }
}
```

- `form.enabled` toggles whether this action exposes a start form.
- `form.fields` is keyed by table field name. Each field can override:
  - `enabled` — show/hide the field in the start form.
  - `required` — mark the field required.
  - `default` — prefill value.
  - `events` — hook names like `onChange`, `onMount` stored for future execution.

If `form.fields` is omitted, the form is auto-populated from the table schema with sensible defaults. This keeps the common case zero-config while allowing per-field customization.

## API changes

### Workflow design routes

Rename `/api/workflows` → `/api/workflow-designs` and `/api/admin/workflows` → `/api/admin/workflow-designs`.

The design resource now includes `starts`:

```ts
{
  id: string
  name: string
  xstateConfig: WorkflowDefinition
  starts: StartRule[]
}
```

`POST`/`PATCH` accept the same shape. The server validates each start rule:

- `db_trigger` options must include `tableName` and `event`.
- `user_trigger` options may be empty.
- `cron` options must include `schedule` (runtime path not implemented yet).

### New workflow-instance route

`POST /api/workflow-instances` starts a user-triggered instance:

```ts
{
  designId: string
  values: Record<string, unknown>
}
```

Behavior:

1. Look up the design and confirm it has at least one `user_trigger` start rule.
2. Build a synthetic record: `{ id: <new instance id>, ...values }`.
3. Create a `workflow_instances` row with `tableName = '_user_trigger'` and `recordId = instance.id`.
4. Call Restate ingress `/workflow/{instanceId}/create` with the full `CreateWorkflowRequest`, including `startState` from the matched start rule.

A matching admin route `POST /api/admin/workflow-instances` handles platform designs.

## Dispatch changes

`apps/api/src/lib/dispatch.ts` keeps the DB-trigger path, but now reads from `workflow_designs.starts`:

```ts
const matching = designs.filter((d) =>
  d.starts?.some(
    (s) => s.type === 'db_trigger' && s.options.tableName === tableName && s.options.event === crudEvent
  )
)
```

Each match produces a start request that includes the rule's `startState`.

A new helper `dispatchUserTrigger(namespace, designId, startState, values, { companyId })` creates the instance and calls Restate. It is invoked from `POST /api/workflow-instances`, not from DB CRUD hooks.

## UI changes

### Workflow design list / detail page

- Rename routes/pages from `/workflows` → `/workflow-designs` (and `/admin/workflows` → `/admin/workflow-designs`).
- Add a **Start rules** section on the design detail page.
- Each rule shows its type, `startState`, and key options (table/event for db_trigger, permissions placeholder for user_trigger).
- The UI selects a sensible default `startState` when a rule is created (e.g. the design's `initial` state).
- For designs with a `user_trigger`, show a **Run** button.

### Action config panel

- For actions that declare `tableInput`, add a "Start form" section.
- The section lists fields from the selected table's schema.
- The user can toggle fields on/off, set required/default, and attach hook names for `onChange`/`onMount`.
- These overrides are saved in `state.meta.form`.

### Run workflow modal

- Clicking **Run** opens a modal whose form is generated from the first action's `tableInput` schema, merged with `state.meta.form` overrides.
- On submit, call `POST /api/workflow-instances` and show success/error feedback.

## Runtime impact

The runtime must honor `CreateWorkflowRequest.startState`. When starting the actor, the runtime compiles a one-off `WorkflowDefinition` whose `initial` property is replaced by `startState`. The rest of the machine is unchanged.

The `form` configuration is UI metadata only; the runtime still receives a synthetic `record` in `CreateWorkflowRequest`. The first action receives `context.record` as usual. If the action's `params` reference `record.<field>` (e.g. `{ $context: 'record.name' }`), the submitted value is used.

## Migration

This is a breaking schema change. A one-time migration is required:

1. Rename table `workflows` → `workflow_designs`.
2. For each existing workflow, read its related `triggers` rows.
3. Build `starts: [{ type: 'db_trigger', startState: definition.initial, options: { tableName, event } }]` and store it on the design.
4. Delete the `triggers` table.
5. Rename `workflow_instances.workflowId` → `designId`.
6. Update `workflow_actions`, `user_tasks`, and any other tables that reference `workflowId` to use `designId`.

Because this touches many files, the implementation should be done in a single focused branch with a full typecheck and runtime test pass.

## Backwards compatibility

- There is no in-place backwards compatibility for old API clients. URLs and column names change.
- The migration script preserves all existing DB-trigger behavior by converting old triggers into `starts` arrays.

## Security / permissions

- `tenantAuth` and `adminAuth` middleware continue to guard routes.
- `db_trigger` creation stays restricted to `owner`/`admin`.
- `user_trigger` execution is open to any authenticated tenant member in this iteration. The reserved `options.permissions` field will later support role-based gating.

## Testing approach

- **Unit tests:** start-rule option validation, synthetic record building, action input extraction, table-schema to form-field mapping.
- **API tests:** create a `workflow_design` with a `user_trigger`, call `POST /api/workflow-instances`, assert instance created and Restate ingress called with correct payload.
- **Migration test:** run the migration script against fixture data and assert old triggers become `starts` arrays and existing instances still resolve to the correct design.
- **Runtime round-trip:** use the existing `apps/workflow-runtime/tests/runtime.test.ts` pattern to start a user-triggered workflow and confirm the first action receives the submitted record.
- **Typecheck:** all modified apps and packages pass `nuxt typecheck` / `tsc`.

## Risks

| Risk | Mitigation |
|---|---|
| Synthetic `record` confuses actions that expect a real DB record | Document that user-triggered workflows should use actions that operate on submitted values or create records themselves. |
| First action has no `inputs` metadata | Start form is empty; workflow starts with `{ id: instanceId }`. This is valid but limited. |
| Wide table/column rename touches many files | Do the rename in one focused branch and verify with full typecheck + runtime tests. |

## Open questions

1. Should the start form validate types client-side using `ActionInputMetadata.type`?
2. Should `workflow_instances` store the submitted `values` separately from the synthetic record for audit purposes?
3. Should user-triggered workflows support multiple active instances per workflow, or only one at a time?
