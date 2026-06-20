---
title: Nested Schema Support for `_columns` and Workflow Action Inputs
type: note
status: in-progress
area: docs
created: 2026-06-19
updated: 2026-06-20
related:
  - [[Schema Registry]]
  - [[Workflow Actions Catalog]]
  - [[Workflow Editor]]
---

# Nested Schema Support for `_columns` and Workflow Action Inputs

## Goal

Allow `_columns` to describe the shape of nested `object` and `object[]` values, and expose that shape to workflow-action inputs so the workflow editor can render nested forms instead of raw JSON.

This is a **declarative, schema-discovery-only** change. Runtime data remains schemaless in SurrealDB; the nested schema is stored as metadata so users know the structure and the UI can render it.

## Non-goals

- Runtime validation beyond the existing display-type coercion.
- First-class sub-column rows or dotted-path database indexes.
- Arrays of arrays.
- Changing how table display columns are configured (that is a separate setting).

## Design

### 1. Recursive `ColumnDefinition`

Add a single recursive `fields` property to `ColumnDefinition`. Nested fields use the same type; validation strips away table-level attributes that do not apply.

```ts
// packages/db/src/schema-definitions.ts
export interface ColumnDefinition {
  name: string
  label?: string
  dbType: 'string' | 'number' | 'boolean' | 'datetime' | 'object' | 'array' | 'record'
  displayType: 'text' | 'url' | 'email' | 'user' | 'select' | 'checkbox' | 'date' | 'number' | 'relation' | 'formula' | 'richText' | 'json'
  config?: Record<string, unknown>
  fields?: ColumnDefinition[]
  system?: boolean
  unique?: boolean
  uniqueScope?: string
  optional?: boolean
  defaultValue?: unknown
  hidden?: boolean
  order?: number
}
```

Rules:
- `fields` is only meaningful when `dbType` is `object` or `array`.
- For `dbType: 'array'`, `fields` describes the shape of each array item. In this design, array items with `fields` must be `object`; primitive arrays stay as opaque `array` without `fields`. Arrays of arrays are out of scope.
- For `dbType: 'object'`, `fields` describes the object's properties.
- Nested fields may recurse without depth limit, but a guard (e.g., 8 levels) may be added during validation to catch accidents.

### 2. Schema registry changes

`packages/db/src/schema-registry.ts`:

- `ColumnInput` / `ColumnRow` inherit the optional `fields` array automatically because they extend `ColumnDefinition`.
- `upsertColumn` persists `fields` directly on the `_columns` row. No migration is needed because `_columns` is schemaless.
- Add validation:
  - Reject `system`, `unique`, `uniqueScope`, or `order` on nested fields.
  - Reject `fields` on primitive `dbType`s.
  - Reject duplicate field names at the same level.
  - Reject cycles.
  - Enforce `isValidIdentifier` on every field name.
- `getTableSchema` returns `fields` unchanged.
- `syncTableSchemaFromRecords` gets a best-effort upgrade: when it infers `object` or `array`, it may recurse and write a `fields` entry. If inference is ambiguous, it falls back to the current opaque `object`/`array`.

### 3. Shared action-input metadata

`packages/shared/src/index.ts`:

```ts
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
  fields?: ActionInputMetadata[]
}
```

This mirrors `ColumnDefinition.fields` so the workflow editor can render nested inputs without a separate transformation layer.

### 4. Workflow-action input resolution

`packages/workflow-actions/src/catalog/resolve-inputs.ts`:

When `meta.tableInput` is set and a table schema is loaded, map each column to `ActionInputMetadata`. If a column has `fields`, recurse and build the nested `fields` array.

Example output for an `invoiceLines` column:

```ts
{
  name: 'invoiceLines',
  label: 'Invoice Lines',
  dbType: 'array',
  displayType: 'json',
  fields: [
    { name: 'id', dbType: 'string', displayType: 'text', required: true },
    { name: 'date', dbType: 'datetime', displayType: 'date' },
    { name: 'item', dbType: 'string', displayType: 'text' },
    { name: 'total', dbType: 'number', displayType: 'number' },
  ]
}
```

### 5. UI rendering and payload building

`layers/workflow-editor/components/WorkflowRunModal.vue` and `workflow-run-modal-helpers.ts`:

- Render nested fields recursively.
  - `dbType: 'object'` → fieldset of child fields.
  - `dbType: 'array'` → list UI where each item is an object form built from `fields`, with add/remove buttons.
- Store form values with dotted paths such as `invoiceLines.0.id` or `address.country.code`.
- `buildPayload` collects dotted-path values and reconstructs the nested object/array structure before submission.
- When `fields` is absent, fall back to the existing raw JSON textarea behavior.

### 6. Validation constraints

- Field names must satisfy `isValidIdentifier`.
- No duplicate field names within the same parent.
- No `fields` on primitive dbTypes.
- `dbType: 'array'` with `fields` requires the single item shape to be `object` (for now).
- Optional depth guard during validation to catch accidental infinite recursion.

### 7. Backward compatibility

- Existing `object`/`array` columns without `fields` continue to render as raw JSON.
- Existing consumers of `ActionInputMetadata` ignore the unknown `fields` property until updated.
- No database migration is required.

### 8. Testing plan

- `packages/db/test/schema-registry.test.ts`
  - Round-trip nested `fields` through `upsertColumn` / `getTableSchema`.
  - Validation rejects invalid nested definitions.
- `packages/workflow-actions/tests/resolve-inputs.test.ts` (or equivalent)
  - `resolveInputs` expands nested columns into nested `ActionInputMetadata`.
- `layers/workflow-editor/components/workflow-run-modal-helpers.test.ts` (or equivalent)
  - `buildPayload` reconstructs objects and arrays from dotted-path form values.

## Dependencies

- `packages/db/src/schema-definitions.ts`
- `packages/db/src/schema-registry.ts`
- `packages/shared/src/index.ts`
- `packages/workflow-actions/src/catalog/resolve-inputs.ts`
- `layers/workflow-editor/components/WorkflowRunModal.vue`
- `layers/workflow-editor/components/workflow-run-modal-helpers.ts`

## Success criteria

- A column can be defined with `dbType: 'array'` and a recursive `fields` schema.
- `getTableSchema` returns the nested schema unchanged.
- Workflow actions that use `tableInput` expose nested inputs.
- The workflow run modal renders nested forms and submits valid nested objects/arrays.
- Existing columns without `fields` behave exactly as before.
- All `db`, `workflow-actions`, and `workflow-editor` tests pass.