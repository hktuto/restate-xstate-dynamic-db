---
title: "Workflow Runtime Snapshot Persistence Design"
type: note
status: planned
area: architecture
app:
  - runtime
  - web
  - admin
package:
  - workflow-actions
created: 2026-06-15
updated: 2026-06-15
related:
  - "[[Workflow Runtime]]"
  - "[[Workflow Engine]]"
  - "[[Workflow Actions Catalog]]"
  - "[[Guards & Conditions]]"
---

# Workflow Runtime Snapshot Persistence Design

This design evolves `apps/workflow-runtime` from a one-shot Restate service into a durable Restate Virtual Object that can persist XState snapshots and receive multiple events over time. It keeps the existing dynamic workflow-definition model and action/guard catalog, and replaces the hardcoded approval pause with a generic `waiting` tag and a `waitFor` handler.

## Decision summary

- **Do not migrate to `@restatedev/xstate`.** The official package requires static machine registration at startup, which conflicts with our goal of letting users create and run workflows dynamically from the editor.
- **Convert `workflow-runtime` from a Restate service to a Restate Virtual Object.** Only Virtual Objects have durable K/V state for snapshot persistence.
- **Keep the current `WorkflowDefinition` shape and catalog.** The workflow editor and action/guard catalog remain unchanged at the source level; the runtime compiles definitions to XState machines on demand.
- **Introduce a `workflow_instances` table.** Each instance gets a SurrealDB record; its ID becomes the Restate object key.
- **Replace `awaitingApproval` with the generic `waiting` tag.** Human tasks are modeled as `user_tasks` with a `type` field (`approval`, `review`, `manual`, etc.).
- **Add `waitFor`, `create`, `send`, and `snapshot` handlers.** These provide the public API for triggers, approvals, and long-polling callers.

## Goals

1. Workflows can receive multiple events over their lifetime.
2. Workflow state survives process restarts and crashes.
3. Approvals are generalized to user tasks and are not hardcoded in the runtime.
4. External callers can block until a workflow reaches a condition (`done`, `hasTag:waiting`).
5. The change is incremental: no fork of `@restatedev/xstate`, no rewrite of the editor.

## Non-goals

- Full XState actor system support (spawned actors, cross-actor communication).
- XState `after` delayed transitions and scheduled events.
- Workflow-definition versioning.
- Native promise actors (`fromPromise`) for catalog actions.

These may be revisited later, but they are out of scope for this design.

## Architecture

### Restate Virtual Object

The runtime exposes a single Virtual Object named `workflow`.

```ts
restate.object({
  name: 'workflow',
  handlers: {
    create,
    send,
    waitFor,
    snapshot,
  },
})
```

### Instance key

Each workflow instance has a SurrealDB record in the `workflow_instances` table. The record ID is used as the Restate object key.

```
workflow_instances:<uuid>
```

This keeps the Restate key short, stable, and queryable, and avoids concatenating namespace/workflowId/recordId into a key.

### Instance record (`workflow_instances`)

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Restate object key |
| `workflowId` | string | Workflow definition ID |
| `tableName` | string | Source table that triggered the instance |
| `recordId` | string | Source record ID |
| `namespace` | string | Tenant or platform namespace |
| `companyId` | string? | Optional company reference |
| `status` | enum | `pending`, `running`, `waiting`, `done`, `error` |
| `createdAt` | datetime | Audit timestamp |
| `updatedAt` | datetime | Audit timestamp |

### Restate K/V state

| Key | Type | Purpose |
|---|---|---|
| `snapshot` | `AnyMachineSnapshot` | Persisted XState snapshot |
| `config` | `WorkflowDefinition` | Workflow definition used by the instance |
| `context` | object | `{ record, tableName, companyId, namespace }` |
| `schemaVersion` | number | Snapshot schema version for future migrations |
| `subscriptions` | `Record<Condition, Subscription>` | Active `waitFor` awakeables |

## Handlers

### `create`

Creates a new machine instance and optionally sends an initial event.

**Input:**

```ts
{
  config: WorkflowDefinition
  event?: string
  record: Record<string, unknown>
  tableName: string
  companyId?: string
  namespace?: string
}
```

**Behavior:**

1. If a snapshot already exists for this key, return the existing snapshot without resetting.
2. Compile `config` to an XState machine using `toXStateConfig`.
3. Build action/guard registries from `workflow-actions/runtime`.
4. Create and start the actor.
5. If `event` is provided, send it.
6. Persist `snapshot`, `config`, and `context`.
7. If the resulting state has the `waiting` tag, create a `user_tasks` record via `ctx.run`.
8. Evaluate subscriptions and resolve matching `waitFor` awakeables.
9. Update the `workflow_instances` status via `ctx.run`.
10. Return the snapshot.

### `send`

Sends an event to an existing instance.

**Input:**

```ts
{
  event: string
  record?: Record<string, unknown> // optional update to actor context
}
```

**Behavior:**

1. Load `snapshot`, `config`, and `context` from Restate state. Return 404 if no snapshot exists.
2. Compile `config` to an XState machine.
3. Build action/guard registries.
4. Create the actor and restore it with `actor.start(snapshot)`.
5. If `record` is provided, update the actor context (e.g., via an `assign` or by replacing `context.record`) so actions/guards see the latest record data.
6. Send the event.
7. Await any action promises scheduled by the registry.
8. Persist the new snapshot.
9. If the resulting state has the `waiting` tag, create or update a `user_tasks` record.
10. Evaluate subscriptions and resolve matching `waitFor` awakeables.
11. Update the `workflow_instances` status via `ctx.run`.
12. Return the snapshot.

### `waitFor`

Blocks until a condition is met.

**Input:**

```ts
{
  condition: 'done' | `hasTag:${string}`
  timeout?: number
  event?: string
}
```

**Behavior:**

1. Load snapshot. Return 404 if none exists.
2. If `event` is provided, send it first (using the same logic as `send`).
3. Evaluate the condition against the current snapshot.
4. If already met, return the snapshot immediately.
5. Otherwise, create a `ctx.awakeable`, register it under the condition in `subscriptions`, and await it.
6. When a later `send` causes the condition to match, resolve the awakeable with the snapshot.
7. If the machine reaches a final state (`status === 'done'`) without meeting the condition, reject the awakeable.
8. If the machine enters an error state (`status === 'error'`), reject the awakeable with the error.
9. If `timeout` is provided, use `promise.orTimeout(timeout)`.

### `snapshot`

Returns the current persisted snapshot.

**Input:** none

**Behavior:**

1. Load snapshot from Restate state.
2. Return 404 if none exists.

## Workflow definition changes

Add optional `tags` and `type` to states:

```ts
interface WorkflowState {
  entry?: (string | { id: string; params?: Record<string, unknown> })[]
  on?: Record<string, WorkflowTransition | WorkflowTransition[]>
  tags?: string[]
  type?: 'final'
}
```

A waiting state looks like:

```ts
states: {
  awaitingApproval: {
    tags: ['waiting'],
    meta: { taskType: 'approval' },
    on: {
      approve: 'active',
      reject: 'rejected'
    }
  }
}
```

The runtime treats any state with the `waiting` tag as requiring a user task. The task type defaults to `approval` but can be overridden via `meta.taskType`.

## Action and guard registries

`packages/workflow-actions/src/runtime/index.ts` continues to build:

- `createActionRegistry(ctx, req)` → maps catalog action IDs to sync XState actions that schedule `ctx.run` promises.
- `createGuardRegistry(req)` → maps catalog guard IDs to sync XState guards.

The `ctx` type changes from `restate.Context` to `restate.ObjectContext`. The runtime awaits all action promises before persisting the snapshot and returning from `send`/`create`.

Catalog actions remain the same metadata-driven wrappers. They are not converted to promise actors in this design.

## User task flow (formerly approvals)

### Data model: `user_tasks`

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Task ID |
| `instanceId` | string | FK to `workflow_instances.id` |
| `type` | enum | `approval`, `review`, `manual`, ... |
| `status` | enum | `pending`, `completed`, `cancelled`, `rejected` |
| `tableName` | string | Source table |
| `recordId` | string | Source record ID |
| `workflowId` | string | Workflow definition ID |
| `createdAt` | datetime | Audit timestamp |
| `resolvedAt` | datetime? | When the task was resolved |

### Runtime behavior

When `send` reaches a state tagged `waiting`:

1. Determine task type from `state.meta.taskType` or default to `approval`.
2. Call `ctx.run('createUserTask', async () => { ... })` to insert a `user_tasks` record.
3. The `user_tasks` record is queryable by `instanceId`; the runtime does not need to store the task ID in Restate state.

### Resolution

1. Admin/user interacts with the UI (`/user-tasks/:id`).
2. The API endpoint sends the appropriate event to the workflow instance:
   - Approve → `POST /workflow/${instanceId}/send` with `{ event: 'approve' }`
   - Reject → `POST /workflow/${instanceId}/send` with `{ event: 'reject' }`
3. The workflow transitions out of the `waiting` state.
4. `send` evaluates subscriptions and resolves any matching `waitFor` awakeables.

No awakeable IDs are stored in the `user_tasks` table. The workflow instance is the source of truth for state.

## Dispatch changes

Current flow:

```ts
POST /workflow/executeWorkflow
idempotency-key: ${tableName}:${event}:${record.id}:${workflowId}
```

New flow:

1. `dispatchTrigger` looks up matching triggers.
2. For each trigger, create a `workflow_instances` record via `packages/db`.
3. Call `POST /workflow/${instanceId}/create` with the full payload.

For follow-up events (e.g., a second update to the same record that should continue the same workflow instance):

1. Look up the `workflow_instances` record for `(workflowId, recordId)` with `status` in `('pending', 'running', 'waiting')`.
2. Call `POST /workflow/${instanceId}/send` with the event.

**Trigger-to-instance mapping rule:** one active instance per `(workflowId, recordId)` pair. If no active instance exists, create one. If multiple active instances exist (an edge case), use the most recently created.

## API and UI changes

- Rename `apps/web/server/api/approvals/*` → `apps/web/server/api/user-tasks/*`.
- Rename `apps/web/app/pages/approvals/*` → `apps/web/app/pages/user-tasks/*`.
- Update `packages/db/src/tenant.ts` to use the `user_tasks` table.
- Update `layers/workflow-editor` to support `tags` and `meta.taskType` on states (can be added incrementally; default to `approval`).

## Migration strategy

1. Add `workflow_instances` and `user_tasks` tables to the DB schema.
2. Rewrite `apps/workflow-runtime/src/index.ts` as a Virtual Object with `create`, `send`, `waitFor`, `snapshot`.
3. Update `packages/workflow-actions/src/runtime/index.ts` to accept `ObjectContext`.
4. Add snapshot restore/persist and subscription evaluation to the runtime.
5. Update dispatch utilities in `apps/web/server/utils/dispatch.ts` and `apps/admin/server/utils/dispatch.ts`.
6. Rename and update approval APIs/UI to user-tasks.
7. Update DB seed workflows to use the `waiting` tag.
8. Add integration tests with `@restatedev/restate-sdk-testcontainers`.
9. Update documentation notes in `docs/30-Apps/Workflow Runtime/` and `docs/50-Features/`.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Actions are not idempotent and could re-run on replay. | Ensure `ctx.run` actions are idempotent, or design workflows so actions only fire on valid transitions. |
| Snapshot format changes later and breaks rehydration. | Version the snapshot schema; store a `schemaVersion` key in Restate state. |
| Restate object keys are limited in length. | Use the short `workflow_instances` record ID as the key. |
| Concurrent sends to the same instance race. | Virtual Objects serialize invocations per key by design. |
| `workflow_instances` record exists but Restate snapshot does not. | Make `create` idempotent; it restores from snapshot or recreates the machine if missing. |

## Out of scope

- Migrating to `@restatedev/xstate`.
- Native promise actors or full actor system.
- Delayed transitions / scheduled events.
- Workflow-definition versioning.
- Generalizing user tasks beyond the `type` field.

## Related

- "[[Workflow Runtime]]"
- "[[Workflow Engine]]"
- "[[Workflow Actions Catalog]]"
- "[[Guards & Conditions]]"
