---
title: Workflow Action Frontend Integration Design
type: note
status: planned
area: workflow
app:
  - web
  - admin
created: 2026-06-17
updated: 2026-06-17
related:
  - [[50-Features/Workflow Engine]]
  - [[50-Features/Workflow Actions Catalog]]
  - [[40-Packages/db]]
  - [[20-Architecture/Data Model]]
---

# Workflow Action Frontend Integration Design

## Goal

Add reusable frontend components and composables so workflow CRUD actions (`getRecord`, `createRecord`, `updateRecord`, `deleteRecord`) can be configured visually using a tenant table schema registry and a visual filter builder. The same components will later power table filtering in the web and admin apps.

## Scope

In scope for this design:

- A shared `packages/schema-filter` package with Vue components and composables.
- Backend schema registry tables (`_tables`, `_columns`, `_relations`) added to tenant (and platform) namespaces.
- DB helpers in `packages/db` to read/write schemas and infer columns from existing records.
- Server API routes for listing tables, fetching schemas, and syncing schemas from records.
- Integration into the workflow editor `ActionConfigPanel.vue` for CRUD action configuration.

Out of scope for the first version:

- Admin UI for manually editing table schemas.
- Advanced filter builder features like drag-and-drop nested groups or sub-queries.
- Filter conversion to SurrealQL for table-list pages (the builder emits the runtime AST; server-side conversion will be added later).

## Architecture

### New package: `packages/schema-filter`

A TypeScript/Vue package that is imported by `layers/workflow-editor`, `apps/web`, and `apps/admin`.

| File | Responsibility |
|------|----------------|
| `src/types.ts` | Shared types: `TableSchema`, `ColumnSchema`, `TableRelation`, `FilterOperator`, `FilterRule`, `FilterGroup`, `FilterAst`. |
| `src/composables/useTableSchemas.ts` | Fetch and cache table schemas from the API. |
| `src/composables/useFilterBuilder.ts` | Manage rule-list state and convert to/from the runtime filter AST. |
| `src/components/SchemaFieldPicker.vue` | Dropdown to pick a field from a schema. |
| `src/components/FilterRule.vue` | Single rule row: field, operator, value input. |
| `src/components/FilterBuilder.vue` | Rule list with AND/OR groups; emits a runtime AST. |
| `src/components/CrudActionForm.vue` | Optional wrapper that wires table/fields/filter/outputKey for CRUD actions. |

### Backend: schema registry

Add three SCHEMALESS tables to tenant namespaces in `packages/db/src/provision.ts` and to the platform namespace in `packages/db/src/seed.ts`:

- `_tables` — table metadata.
- `_columns` — column metadata per table.
- `_relations` — relations between tables.

New DB helpers in `packages/db`:

- `listTables(namespace)` — list all `_tables` records.
- `getTableSchema(namespace, tableName)` — return a `TableSchema` with columns and relations.
- `upsertTable(namespace, table)` — create/update a `_tables` row.
- `upsertColumn(namespace, column)` — create/update a `_columns` row.
- `upsertRelation(namespace, relation)` — create/update a `_relations` row.
- `syncTableSchemaFromRecords(namespace, tableName, sampleSize?)` — scan records, infer columns, upsert `_columns`.

Record shapes:

```ts
export interface TableSchemaRecord {
  id: string
  name: string
  label?: string
  description?: string
}

export interface ColumnSchemaRecord {
  id: string
  table: string
  name: string
  label?: string
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'record' | 'array' | 'object'
  optional?: boolean
  defaultValue?: unknown
}

export interface TableRelationRecord {
  id: string
  fromTable: string
  toTable: string
  fromColumn: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
}
```

### API routes

Tenant routes in `apps/web/server/api/tables/`:

- `index.get.ts` — `GET /api/tables` → list tables.
- `[name].get.ts` — `GET /api/tables/:name` → get schema for one table.
- `[name]/sync.post.ts` — `POST /api/tables/:name/sync` → infer and store columns from records.

Admin/platform routes in `apps/admin/server/api/tables/` mirror the above for platform workflows.

### Filter builder output

The filter builder emits the same MongoDB-style AST already consumed by `packages/workflow-actions/src/runtime/query-builder.ts` and `packages/workflow-actions/src/runtime/expression.ts`.

Supported operators for the first version:

- `$eq`, `$ne`
- `$gt`, `$gte`, `$lt`, `$lte`
- `$in`, `$nin`
- `$exists`
- `$contains`, `$startsWith`, `$endsWith` (string fields)

Rule values are typed by the selected column (string, number, boolean, datetime). The builder resolves context references such as `$context.record.<field>` via a dedicated picker.

### Workflow editor integration

Update `layers/workflow-editor/components/ActionConfigPanel.vue`:

- For CRUD actions, render `CrudActionForm` instead of generic JSON fields.
- `getRecord` shows table picker, result type, output key, and `FilterBuilder`.
- `createRecord` shows table picker and a field/value form driven by schema.
- `updateRecord` shows table picker, record id (or context fallback), field/value form, and output key.
- `deleteRecord` shows table picker, record id, mode, and output key.
- Keep a "Show JSON" toggle so power users can still edit raw params.

## Data flow

1. User opens a state in `DetailsPanel.vue`.
2. `ActionConfigPanel.vue` receives the action config.
3. For CRUD actions, `CrudActionForm` uses `useTableSchemas` to load schemas.
4. The table picker renders from `listTables`.
5. Selecting a table loads its schema via `getTableSchema`.
6. `FilterBuilder` uses the schema to populate field/operator/value controls.
7. User edits params; the form emits the same shape the runtime expects.

## Schema population

Since SurrealDB tables are SCHEMALESS, the registry must be populated. First version includes:

- `syncTableSchemaFromRecords` helper that scans a sample of records and infers column names and types.
- API route to trigger a sync per table.
- A future admin UI will allow manual editing and hiding of inferred columns.

## Error handling

- `useTableSchemas` exposes `status`, `error`, and retry.
- If a schema is missing, the builder falls back to plain string inputs for table/field names.
- Invalid filter rules are surfaced per rule and block form submission.

## Testing strategy

- Unit tests for `useFilterBuilder` AST conversion in `packages/schema-filter/tests/`.
- Unit tests for schema inference in `packages/db/tests/`.
- Integration tests for API routes in `apps/web/tests/`.
- Manual/visual test: configure a `getRecord` action in the workflow editor and run a workflow.

## Files to create or modify

| File | Change |
|------|--------|
| `packages/schema-filter/package.json` | New package. |
| `packages/schema-filter/src/types.ts` | Shared types. |
| `packages/schema-filter/src/composables/*.ts` | Composables. |
| `packages/schema-filter/src/components/*.vue` | Components. |
| `packages/db/src/provision.ts` | Add `_tables`, `_columns`, `_relations`. |
| `packages/db/src/seed.ts` | Add `_tables`, `_columns`, `_relations` to platform. |
| `packages/db/src/schema-registry.ts` | New DB helpers. |
| `packages/db/package.json` | Add `./schema-registry` export if needed. |
| `apps/web/server/api/tables/*.ts` | Tenant schema API. |
| `apps/admin/server/api/tables/*.ts` | Platform schema API. |
| `layers/workflow-editor/components/ActionConfigPanel.vue` | Use schema/filter components. |
| `docs/40-Packages/schema-filter.md` | Package docs. |
| `docs/50-Features/Workflow Engine.md` | Update action config section. |
| `docs/20-Architecture/Data Model.md` | Add schema registry tables. |

## Open questions

1. Should `_tables/_columns/_relations` also be queryable from platform workflows? Yes — provision them in both platform and tenant namespaces.
2. Should the schema-filter package expose a Nuxt module for auto-imports, or should consumers import explicitly? First version uses explicit imports to keep the package framework-agnostic; the workflow-editor layer can re-export the most common pieces.
3. How should relation traversal be represented in the filter builder? Deferred to a later version; first version only filters on the selected table's columns.

## Related

- [[50-Features/Workflow Engine]]
- [[50-Features/Workflow Actions Catalog]]
- [[40-Packages/db]]
- [[20-Architecture/Data Model]]
