---
title: Real CRUD Workflow Actions & Guards
type: note
status: in-progress
area: docs
created: 2026-06-16
updated: 2026-06-16
related:
  - [[Workflow Actions Catalog]]
  - [[Guards & Conditions]]
  - [[Workflow Engine]]
  - [[40-Packages/workflow-actions]]
---

# Real CRUD Workflow Actions & Guards

## Goal

Replace the current proof-of-concept workflow actions with a small, reusable set of CRUD building blocks that can be composed into real tenant workflows. The building blocks must be simple enough for non-technical users to wire together in the visual editor, while leaving room for future extension (sorting, grouping, aggregations, integrations).

## Terminology

We align the user-facing vocabulary with XState concepts:

- **Action** = XState state (a box on the canvas).
- **Result** = XState transition (an arrow out of a box).

Every action emits named results. CRUD actions emit `ok` and `error`. The `condition` action emits `true` and `false`.

## Context model

The workflow runtime maintains a dynamic JavaScript context object.

### Auto-injected context

- `context.record` — the record that triggered the workflow.
- `context.event` — the trigger event name (`create`, `update`, `delete`).
- `context.tableName` — the table that triggered the workflow.
- `context.companyId` — the active company id.
- `context.namespace` — the SurrealDB namespace.

### Action outputs

Each action can write its result to a named key in context. The key is called `outputKey`. If the user does not provide one, the editor auto-generates it from the action and table name.

### Error context

On any action failure, the runtime writes error details to `context.lastError`.

## Action metadata shape

Every action state stores its configuration in XState's standard `meta` property:

```ts
state.meta = {
  action: 'getRecord' | 'createRecord' | 'updateRecord' | 'deleteRecord' | 'condition',
  params: { ... },
  outputKey?: string
}
```

`meta` is ignored by XState itself, so the runtime is free to read it when entering the state.

## CRUD actions

### `getRecord`

Query records from a table.

```ts
params: {
  table: string
  filter: MongoDBStyleFilter
  result: {
    type: 'first' | 'list'
    outputKey?: string   // auto: singular table name or `${tableName}List`
  }
}
```

Results: `ok`, `error`.

The result payload is assigned to `context[<outputKey>]`:

- `type: 'first'` — a single record object or `null`.
- `type: 'list'` — an array of record objects (possibly empty).

### `createRecord`

Insert a new record into a table.

```ts
params: {
  table: string
  fields: Record<string, unknown>   // static values in v1
}
outputKey?: string                    // auto: `new${capitalize(table)}`
```

Results: `ok`, `error`.

The created record is assigned to `context[<outputKey>]`.

### `updateRecord`

Update one or more fields on an existing record.

```ts
params: {
  table: string
  id?: string                         // optional, defaults to context.record.id
  fields: Record<string, unknown>
}
outputKey?: string                    // auto: `updated${capitalize(table)}`
```

Results: `ok`, `error`.

The updated record is assigned to `context[<outputKey>]`.

### `deleteRecord`

Remove a record, with soft-delete as the default.

```ts
params: {
  table: string
  id?: string                         // optional, defaults to context.record.id
  mode: 'soft' | 'hard'               // default: 'soft'
}
outputKey?: string                    // auto: `deleted${capitalize(table)}`
```

Results: `ok`, `error`.

- `soft` — sets `status` to `'deleted'` (or adds a `deletedAt` timestamp in a future version).
- `hard` — runs a SurrealDB `DELETE` statement.

## `condition` action

A dedicated action that evaluates a MongoDB-style expression and branches on the result.

```ts
params: {
  expression: MongoDBStyleExpression
}
```

Results: `true`, `false`.

Example expression:

```json
{
  "$and": [
    { "$eq": ["$context.record.status", "active"] },
    {
      "$or": [
        { "$eq": ["$context.record.role", "owner"] },
        { "$eq": ["$context.record.role", "admin"] }
      ]
    }
  ]
}
```

Values prefixed with `$context.` are resolved from the runtime context. Everything else is treated as a literal.

## MongoDB-style filter & expression syntax

Filters and expressions use the same operator vocabulary:

```ts
type MongoDBStyleFilter = {
  [field: string]: { [op: string]: unknown } | MongoDBStyleFilter
} & {
  $and?: MongoDBStyleFilter[]
  $or?: MongoDBStyleFilter[]
  $not?: MongoDBStyleFilter
}
```

Supported operators in v1:

- `$eq` — exact equality
- `$ne` — not equal
- `$exists` — field exists / does not exist
- `$in` — value in array
- `$nin` — value not in array

Reserved for future versions:

- `$gt`, `$gte`, `$lt`, `$lte`
- `$contains`, `$startsWith`, `$endsWith`
- `$and`, `$or`, `$not`
- `$regex`

Dot notation (e.g., `profile.age`) is supported for nested fields.

## Runtime behavior

1. When the actor enters an action state, the runtime reads `state.meta.action` and `state.meta.params`.
2. The runtime executes the matching action handler, passing:
   - `event` — the XState event.
   - `context` — the current workflow context.
   - `params` — the action params.
3. On success:
   - If the action produces a result, assign it to `context[outputKey]`.
   - Send the success result event (`ok` for CRUD, `true` for condition).
4. On failure:
   - Assign error details to `context.lastError`.
   - Send the failure result event (`error` for CRUD, `false` for condition).

## Editor changes

- Add a config panel for action states with fields for:
  - `table` selector
  - `filter` / `fields` / `expression` form builder
  - `outputKey` input (auto-generated, overridable)
  - `id` and `mode` inputs where applicable
- Render result transitions as labeled arrows (`ok`/`error`, `true`/`false`).
- Move or remove POC actions (`log`, `setStatusActive`, `provisionCompanyNamespace`) from the default catalog.

## Error handling

- Every action exposes an `error` result.
- The workflow designer can route `error` to any state, typically a shared error handler or terminal state.
- `context.lastError` contains the error message and action id for diagnostics.

## Out of scope for v1

- Context references inside `fields` values beyond simple `$context.record.id`.
- `groups`, `sorting`, `limit`, `offset` in `getRecord`.
- Custom integration actions such as `sendEmail` or `sendWebhook` (same plugin shape, added later).
- Typed context schema / variables panel.
- Retry, timeout, and compensation logic.

## Migration from POC actions

- Replace `setStatusActive` with `updateRecord`.
- Replace `provisionCompanyNamespace` with a trigger-backed provisioning workflow using `createRecord` / `updateRecord`.
- Keep `log` and `sendWebhook` only if needed for debugging; otherwise remove from the catalog.

## Files likely to change

- `packages/workflow-actions/src/catalog/actions.ts`
- `packages/workflow-actions/src/catalog/guards.ts`
- `packages/workflow-actions/src/runtime/actions.ts`
- `packages/workflow-actions/src/runtime/guards.ts`
- `packages/workflow-actions/src/runtime/index.ts`
- `packages/shared/src/index.ts` (metadata types)
- `apps/workflow-runtime/src/compile.ts`
- `apps/workflow-runtime/src/workflow.ts`
- `layers/workflow-editor/components/ActionListEditor.vue`
- `layers/workflow-editor/components/DetailsPanel.vue`
- `layers/workflow-editor/composables/useWorkflowActions.ts`
- `docs/50-Features/Workflow Actions Catalog.md`
- `docs/50-Features/Guards & Conditions.md`
