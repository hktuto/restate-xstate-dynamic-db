---
title: Dynamic Table Schema & Table Query Layer Design
type: note
status: in-progress
area: docs
created: 2026-06-17
updated: 2026-06-17
related:
  - [[50-Features/Workflow Engine]]
  - [[50-Features/Workflow Actions Catalog]]
  - [[40-Packages/db]]
  - [[20-Architecture/Data Model]]
  - [[50-Features/Table Query]]
---

# Dynamic Table Schema & Table Query Layer Design

## Goal

Migrate all tables in the system to a schema-driven style backed by `_tables`, `_columns`, and `_relations`, and provide a reusable `TableQuery` component that every table view can use to display records with filter groups, sorting, grouping, and keyword search.

## Scope

In scope for this design:

- A shared `layers/schema-manager` layer with Vue components and composables.
- Backend schema registry tables (`_tables`, `_columns`, `_relations`) added to tenant and platform namespaces.
- DB helpers in `packages/db` to read/write schemas, infer columns from records, and manage relations/formulas.
- Server API routes for listing tables, fetching schemas, syncing schemas from records, and saving column metadata.
- A reusable `TableQuery` component with filter groups, sorting, grouping, and keyword search.
- A type system for dual column types (`displayType` + `dbType`), per-type config, unique options, relations, and formulas.

Out of scope for the first version:

- Admin UI for manually editing table schemas (sync from records is the first source of truth).
- Workflow action CRUD configuration in the editor (deferred until the table-query layer is in place).
- Advanced filter builder features like drag-and-drop nested groups or sub-queries.
- Filter conversion to SurrealQL for table-list pages (the builder emits the runtime AST; server-side conversion will be added later).
- Formula runtime evaluation (the registry stores formulas; evaluation is a future runtime concern).

## Architecture

### New layer: `layers/schema-manager`

A TypeScript/Vue layer imported by `apps/web` and `apps/admin` (and later by `layers/workflow-editor` for workflow CRUD configuration).

| File | Responsibility |
|------|----------------|
| `layers/schema-manager/src/types.ts` | Shared types: `TableSchema`, `ColumnSchema`, `ColumnDisplayType`, `ColumnDbType`, `ColumnConfig`, `TableRelationRecord`, `FormulaConfig`, `FilterOperator`, `FilterRule`, `FilterGroup`, `FilterAst`. |
| `layers/schema-manager/src/composables/useTableSchemas.ts` | Fetch and cache table schemas from the API. |
| `layers/schema-manager/src/composables/useFilterBuilder.ts` | Manage rule-list state and convert to/from the runtime filter AST. |
| `layers/schema-manager/src/composables/useTableQuery.ts` | Manage keyword, filter, sort, group, and pagination state for `TableQuery`. |
| `layers/schema-manager/src/components/SchemaFieldPicker.vue` | Dropdown to pick a field from a schema. |
| `layers/schema-manager/src/components/FilterRule.vue` | Single rule row: field, operator, value input. |
| `layers/schema-manager/src/components/FilterBuilder.vue` | Rule list with AND/OR groups; emits a runtime AST. |
| `layers/schema-manager/src/components/TableQuery.vue` | Reusable table query component: combines search, filter, sort, group, and data grid. |
| `layers/schema-manager/src/components/TableFilterBar.vue` | Toolbar for keyword search and filter-group chips. |
| `layers/schema-manager/src/components/TableSortPicker.vue` | Sort field/direction picker. |
| `layers/schema-manager/src/components/TableGroupPicker.vue` | Group-by column picker. |

### Backend: schema registry

Add three SCHEMALESS tables to tenant namespaces in `packages/db/src/provision.ts` and to the platform namespace in `packages/db/src/seed.ts`:

- `_tables` — table metadata.
- `_columns` — column metadata per table.
- `_relations` — explicit relations between tables.

### Tenant isolation

The project uses **one SurrealDB namespace per tenant** with a single `main` database inside it. This is the pattern SurrealDB recommends for SaaS multi-tenancy and matches the existing `x-company-namespace` resolution. It gives strong data/auth isolation, lets tenants use simple table names, and leaves room for multiple databases per tenant later. The `database` parameter is still carried through the API and DB helpers so the layer stays honest about the full `namespace--database--table` path.

New DB helpers in `packages/db/src/schema-registry.ts`:

- `listTables(namespace, database)` — list all `_tables` records.
- `getTableSchema(namespace, database, tableName)` — return a `TableSchema` with columns and relations.
- `upsertTable(namespace, database, table)` — create/update a `_tables` row.
- `upsertColumn(namespace, database, column)` — create/update a `_columns` row.
- `upsertRelation(namespace, database, relation)` — create/update a `_relations` row.
- `syncTableSchemaFromRecords(namespace, database, tableName, sampleSize?)` — scan records, infer display/db types, upsert `_columns`.

### Column type system

Each column has two independent type dimensions:

- `dbType` — how the value is stored in SurrealDB.
- `displayType` — how the value is rendered and edited in the UI.

```ts
export type ColumnDbType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'datetime'
  | 'object'
  | 'array'
  | 'record'

export type ColumnDisplayType =
  | 'text'
  | 'url'
  | 'email'
  | 'user'
  | 'select'
  | 'checkbox'
  | 'date'
  | 'number'
  | 'relation'
  | 'formula'
  | 'richText'
```

`ColumnConfig` is a union keyed by `displayType` so each display type carries only its own options. Examples:

```ts
export interface TextColumnConfig {
  displayType: 'text'
  minLength?: number
  maxLength?: number
  placeholder?: string
}

export interface SelectColumnConfig {
  displayType: 'select'
  options: Array<{ label: string; value: string }>
  allowOther?: boolean
  multiple?: boolean
}

export interface UserColumnConfig {
  displayType: 'user'
  role?: string
  multi?: boolean
}

export interface RelationColumnConfig {
  displayType: 'relation'
  relationId: string
  displayField?: string
  multi?: boolean
}

export interface FormulaColumnConfig {
  displayType: 'formula'
  formula: FormulaConfig
}

export type ColumnConfig =
  | TextColumnConfig
  | SelectColumnConfig
  | UserColumnConfig
  | RelationColumnConfig
  | FormulaColumnConfig
  | { displayType: Exclude<ColumnDisplayType, 'text' | 'select' | 'user' | 'relation' | 'formula'> }
```

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
  dbType: ColumnDbType
  displayType: ColumnDisplayType
  config: ColumnConfig
  unique?: boolean
  uniqueScope?: 'table' | string
  optional?: boolean
  defaultValue?: unknown
  hidden?: boolean
}

export interface TableRelationRecord {
  id: string
  name?: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  linkTable?: string
}

export type FormulaConfig = ExpressionFormulaConfig | AggregateFormulaConfig

export interface ExpressionFormulaConfig {
  kind: 'expression'
  expression: string
  dependencies: string[]
}

export interface AggregateFormulaConfig {
  kind: 'aggregate'
  relationId: string
  aggregator: 'count' | 'sum' | 'avg' | 'min' | 'max'
  field?: string
}
```

### Relations

Relations are stored in `_relations` as the single source of truth for every foreign-key-style link between tables. Columns and formulas reference a relation by `relationId` instead of duplicating `fromTable/toTable` metadata.

Three relation-backed field types are supported:

1. **Relation column** (`displayType: 'relation'`) — stores a foreign-key reference (or array of references). Renders as a picker that reads from the related table and shows the configured `displayField`.
2. **Lookup column** (`displayType: 'relation'`) — same as a relation column, but its purpose is read-only display of a field from the related record (e.g., show a project's name next to its id).
3. **Aggregate formula column** (`displayType: 'formula'` with `AggregateFormulaConfig`) — computes `count`, `sum`, `avg`, `min`, or `max` over a relation (e.g., count tasks for a project).

For the first version:

- Relations are discovered/created when syncing a table that contains record ids pointing at other tables, or by explicit API call.
- The filter builder does not traverse relations; it filters on columns of the selected table.
- The schema API returns a `TableSchema` with a `relations` array so the UI can show related tables and populate relation pickers.

### Formulas

Formula columns are display-only computed columns. Two kinds are supported:

- **Expression formulas** — an expression string plus dependency column names, evaluated by the future runtime expression engine (same engine used for workflow conditions).
- **Aggregate formulas** — compute `count`, `sum`, `avg`, `min`, or `max` over a relation defined in `_relations`.

Runtime evaluation is out of scope for the first version; the registry stores formulas so the UI can render them and future runtime code can evaluate them.

### Unique options

- `unique?: boolean` — whether values must be unique within the scope.
- `uniqueScope?: 'table' | string` — scope for uniqueness; default is the table.
- No required/NOT-NULL concept at the schema level. Columns are optional by default; UI-level validation can be driven by `optional` or by workflow action logic.

### API routes

Table identifiers in URLs use the `--` separator to avoid collision with SurrealDB record ids (`:`):

```
/api/tables/:namespace--:database
/api/tables/:namespace--:database/:table
```

Tenant routes in `apps/web/server/api/tables/`:

- `index.get.ts` — `GET /api/tables/:namespace--:database` → list tables in a namespace/database.
- `[table].get.ts` — `GET /api/tables/:namespace--:database/:table` → get schema for one table.
- `[table]/sync.post.ts` — `POST /api/tables/:namespace--:database/:table/sync` → infer and store columns from records.
- `[table]/query.post.ts` — `POST /api/tables/:namespace--:database/:table/query` → query records with keyword, filter AST, sort, group, pagination.
- `[table]/columns/index.post.ts` — `POST /api/tables/:namespace--:database/:table/columns` → save column metadata.

A shared helper parses the `:namespace--:database` segment (and the optional `:table`) so handlers receive `{ namespace, database, table }`.

Admin/platform routes in `apps/admin/server/api/tables/` mirror the above for platform namespaces/databases.

### Filter builder output

The filter builder emits the same MongoDB-style AST already consumed by `packages/workflow-actions/src/runtime/query-builder.ts` and `packages/workflow-actions/src/runtime/expression.ts`.

Supported operators for the first version:

- `$eq`, `$ne`
- `$gt`, `$gte`, `$lt`, `$lte`
- `$in`, `$nin`
- `$exists`
- `$contains`, `$startsWith`, `$endsWith` (string fields)

Rule value inputs are chosen by the column's `displayType`/`dbType`. Context references such as `$context.record.<field>` are available through a dedicated picker.

## Table query component

`TableQuery.vue` is the primary reusable component. It accepts `namespace`, `database`, `table`, and an optional initial query state, then renders:

- Keyword search input.
- Filter groups (chips + `FilterBuilder` drawer/modal).
- Sort picker.
- Group-by picker.
- Data grid that lists records using the schema to format each cell.

The component uses `useTableSchemas` to load the schema and a new `useTableQuery` composable to manage query state. Query state is serializable so it can be stored in URL params, saved views, or workflow action configs later.

## Data flow

1. A page renders `TableQuery table="projects"`.
2. `TableQuery` loads the schema via `useTableSchemas` and calls `GET /api/tables/:namespace--:database/projects`.
3. User enters a keyword, adds filter rules, picks sort/group options.
4. `useTableQuery` builds a query payload: `{ keyword, filterAst, sort, groupBy, pagination }`.
5. The component fetches records from a generic table-data endpoint (e.g., `POST /api/tables/:namespace--:database/:table/query`).
6. The grid renders each row using the column's `displayType` to choose the cell component.
7. URL query params stay in sync so the view is shareable.

## Schema population

Since SurrealDB tables are SCHEMALESS, the registry must be populated. First version includes:

- `syncTableSchemaFromRecords` helper that scans a sample of records and infers column names, db types, and display types.
- API route to trigger a sync per table.
- A future admin UI will allow manual editing, hiding, and adding formulas/relations.

Inference heuristics:

- `typeof value === 'boolean'` → `dbType: 'boolean'`, `displayType: 'checkbox'`.
- `typeof value === 'number'` → `dbType: 'number'`, `displayType: 'number'`.
- ISO datetime string → `dbType: 'datetime'`, `displayType: 'date'`.
- Array → `dbType: 'array'`.
- Object → `dbType: 'object'`.
- String matching email/url patterns → `displayType: 'email'`/`'url'`.
- String containing a record id (`table:id`) → `displayType: 'relation'`, `dbType: 'record'`. A `_relations` row is upserted (`fromTable`, `fromColumn` → `toTable` inferred from the id prefix) and the column config stores `relationId`.
- Otherwise string → `displayType: 'text'`.

## Error handling

- `useTableSchemas` exposes `status`, `error`, and retry.
- If a schema is missing, the builder falls back to plain string inputs for table/field names.
- Invalid filter rules are surfaced per rule and block form submission.

## Testing strategy

- Unit tests for `useFilterBuilder` AST conversion in `layers/schema-manager/tests/`.
- Unit tests for type inference and schema registry helpers in `packages/db/tests/`.
- Integration tests for API routes in `apps/web/tests/`.
- Manual/visual test: render `TableQuery` for an existing tenant table, apply filters/sort/group, and verify records load and format correctly.

## Files to create or modify

| File | Change |
|------|--------|
| `layers/schema-manager/package.json` | New layer package. |
| `layers/schema-manager/src/types.ts` | Shared types. |
| `layers/schema-manager/src/composables/*.ts` | Composables. |
| `layers/schema-manager/src/components/*.vue` | Components. |
| `packages/db/src/provision.ts` | Add `_tables`, `_columns`, `_relations`. |
| `packages/db/src/seed.ts` | Add `_tables`, `_columns`, `_relations` to platform. |
| `packages/db/src/schema-registry.ts` | New DB helpers. |
| `packages/db/package.json` | Add `./schema-registry` export if needed. |
| `apps/web/server/api/tables/*.ts` | Tenant schema API and query endpoint. |
| `apps/admin/server/api/tables/*.ts` | Platform schema API and query endpoint. |
| `apps/web/pages/<entity>/index.vue` | Example pages that render `TableQuery`. |
| `apps/admin/pages/<entity>/index.vue` | Admin example pages that render `TableQuery`. |
| `docs/40-Packages/schema-manager.md` | Layer docs. |
| `docs/50-Features/Table Query.md` | Feature docs for the reusable table query component. |
| `docs/20-Architecture/Data Model.md` | Add schema registry tables. |

## Open questions

1. Should `_tables/_columns/_relations` also be queryable from platform workflows? Yes — provision them in both platform and tenant namespaces.
2. Should the schema-manager layer expose a Nuxt module for auto-imports, or should consumers import explicitly? First version uses explicit imports to keep the layer framework-agnostic; the workflow-editor layer can re-export the most common pieces.
3. How should relation traversal be represented in the filter builder? Deferred to a later version; first version only filters on the selected table's columns.

## Related

- [[50-Features/Table Query]]
- [[50-Features/Workflow Engine]]
- [[50-Features/Workflow Actions Catalog]]
- [[40-Packages/db]]
- [[20-Architecture/Data Model]]
