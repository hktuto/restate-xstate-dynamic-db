---
title: Workflow Actions Catalog
type: feature
status: planned
area: workflow
created: 2026-06-14
updated: 2026-06-17
app:
  - web
  - admin
  - runtime
related:
  - [[40-Packages/workflow-actions]]
  - [[50-Features/Guards & Conditions]]
  - [[50-Features/Workflow Engine]]
---

# Workflow Actions Catalog

## Overview

Reusable CRUD and logic actions that can be composed into tenant workflows. Each action is represented as a state on the canvas and emits named result events (`ok`/`error` or `true`/`false`).

## Action states

Action configuration lives in `state.meta`:

```ts
state.meta = {
  action: 'getRecord' | 'createRecord' | 'updateRecord' | 'deleteRecord' | 'condition',
  params: { ... },
  outputKey?: string
}
```

## CRUD actions

### `getRecord`

Query records from a table.

```ts
params: {
  table: string
  filter?: MongoDBStyleFilter
  result?: { type: 'first' | 'list' }
}
outputKey?: string
```

Results: `ok`, `error`.

### `createRecord`

Insert a new record.

```ts
params: {
  table: string
  fields: Record<string, unknown>
}
outputKey?: string
```

Results: `ok`, `error`.

### `updateRecord`

Update an existing record. `id` defaults to `context.record.id`.

```ts
params: {
  table: string
  id?: string
  fields: Record<string, unknown>
}
outputKey?: string
```

Results: `ok`, `error`.

### `deleteRecord`

Delete a record. `id` defaults to `context.record.id`; `mode` defaults to `soft`.

```ts
params: {
  table: string
  id?: string
  mode?: 'soft' | 'hard'
}
outputKey?: string
```

Results: `ok`, `error`.

## Logic actions

### `condition`

Evaluate a MongoDB-style expression and branch on `true`/`false`.

```ts
params: {
  expression: MongoDBStyleExpression
}
```

Results: `true`, `false`.

## Error handling

On any action failure the runtime sets `context.lastError.message`. Workflows should route the `error` result event to a handler or terminal state.

## Adding a new action

1. Add metadata to `packages/workflow-actions/src/catalog/actions.ts`.
2. Add a runtime handler to `packages/workflow-actions/src/runtime/actions.ts`.
3. Add a test to `packages/workflow-actions/tests/actions.test.ts`.

## Related

- [[40-Packages/workflow-actions|workflow-actions package]]
- [[50-Features/Guards & Conditions|Guards & Conditions]]
- [[50-Features/Workflow Engine|Workflow Engine]]
