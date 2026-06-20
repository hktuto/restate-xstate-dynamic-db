---
title: Nested Schema for JSON Columns: `triggerBy` and `starts`
type: note
status: in-progress
area: docs
created: 2026-06-19
updated: 2026-06-20
related:
  - [[Nested Schema Support for _columns and Workflow Action Inputs]]
  - [[Schema Registry]]
---

# Nested Schema for JSON Columns: `triggerBy` and `starts`

## Goal

Annotate the known JSON-shaped columns `workflow_instances.triggerBy` and `workflow_designs.starts` with recursive nested `fields` schemas in `packages/db/src/schema-definitions.ts`, so the schema registry can introspect and expose their structure.

This is a **schema-annotation-only** change. Runtime data remains schemaless in SurrealDB, and no validators are generated yet.

## Non-goals

- Runtime validation of `triggerBy`/`starts` payloads.
- Deriving TypeScript `StartRule`/`TriggerBy` types from the column definitions.
- Changing API route or runtime behavior.
- Annotating open-ended JSON columns such as `context`, `xstateConfig`, or action I/O fields.

## Design

### 1. Builder usage

Use the existing `column()` helper’s `extra` bag to pass `fields`. The `column()` function spreads `extra` into the `ColumnDefinition`, and `schema-registry.ts` already persists and validates nested `fields`.

### 2. `workflow_instances.triggerBy`

`triggerBy` is an object with two required string fields:

```ts
column('triggerBy', 'object', 'json', {
  fields: [
    column('type', 'string', 'select', {
      config: { options: buildOptions(['db_trigger', 'user_trigger', 'cron', 'webhook']) },
    }),
    column('startState', 'string', 'text'),
  ],
})
```

### 3. `workflow_designs.starts`

`starts` is an array of objects. In this design, `dbType: 'array'` with `fields` describes the shape of each array item. The item has three fields: `type`, `startState`, and an optional `options` object.

```ts
column('starts', 'array', 'json', {
  fields: [
    column('type', 'string', 'select', {
      config: { options: buildOptions(['db_trigger', 'user_trigger', 'cron', 'webhook']) },
    }),
    column('startState', 'string', 'text'),
    column('options', 'object', 'json', { optional: true }),
  ],
})
```

### 4. Platform and tenant schemas

Both `PLATFORM_TABLE_SCHEMAS` and `TENANT_TABLE_SCHEMAS` define `workflow_designs` and `workflow_instances`. The same nested schemas must be added to both copies.

### 5. Consistency with TypeScript types

The hand-written interfaces in `packages/shared/src/index.ts` remain authoritative:

```ts
export interface TriggerBy {
  type: 'db_trigger' | 'user_trigger' | 'cron' | 'webhook'
  startState: string
}

export interface StartRule {
  type: 'db_trigger' | 'user_trigger' | 'cron' | 'webhook'
  startState: string
  options?: Record<string, unknown>
}
```

The column definitions are manually aligned to these interfaces. If the interfaces change in the future, the column schemas must be updated to match.

### 6. Validation rules already enforced by the registry

Because `schema-registry.ts` already validates nested `fields`, the new definitions will automatically be checked for:

- Valid identifiers for every nested field name.
- No duplicate field names at the same level.
- No `system`, `unique`, `uniqueScope`, or `order` on nested fields.
- `fields` only on `object` or `array` dbTypes.

The `options` field is declared as `dbType: 'object'` with no nested `fields`, so it remains opaque JSON and satisfies the registry rules.

## Dependencies

- `packages/db/src/schema-definitions.ts`
- `packages/db/src/schema-registry.ts` (existing validation)
- `packages/db/test/schema-definitions.test.ts` (or equivalent new test)

## Testing plan

1. Update `packages/db/test/schema-definitions.test.ts` to assert:
   - `workflow_instances.triggerBy` has nested fields `type` and `startState`.
   - `workflow_designs.starts` has `dbType: 'array'` and nested item fields `type`, `startState`, and `options`.
   - Field optionality matches the design (`options` optional, others required by default).
2. Run `pnpm --filter db typecheck`.
3. Run `pnpm --filter db test` to confirm the schema registry still accepts and persists the new definitions.

## Success criteria

- `triggerBy` and `starts` carry nested `fields` schemas in both platform and tenant table definitions.
- `pnpm --filter db typecheck` passes.
- `pnpm --filter db test` passes, including schema-registry and schema-definition tests.
- No runtime behavior changes outside the schema registry.
