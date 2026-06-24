---
title: Views
type: feature
status: in-progress
area: workflow
app:
  - admin
  - web
created: 2026-06-20
updated: 2026-06-21
related:
  - [[40-Packages/db]]
  - [[40-Packages/data-table-layer]]
  - [[Schema Registry Model]]
  - [[30-Apps/Admin/Overview]]
  - [[30-Apps/Web App/Overview]]
---

# Views

## Overview

Views are saved presentation presets for a table. A view defines which columns to show, how to order them, and what view type to use. The UI renders a table by loading a view and the table schema, then applies the view config to decide column visibility, labels, and widths.

Views reference `_columns` for normal columns and `_relations` for lookup columns. See [[Schema Registry Model]] for how these system tables interact.

## Responsibilities

- Store saved table views per tenant namespace in `_views`.
- Generate a default table view for every table during provisioning.
- Expose CRUD APIs for listing, creating, updating, and deleting views.
- Render a table using a view + schema + records.

## Data model

```ts
interface ViewDefinition {
  id?: string
  table: string
  resourceType?: string
  type: 'table'
  name: string
  description?: string
  isDefault?: boolean
  config: ViewConfig
  filter?: FilterGroup
  sort?: SortSetting[]
  group?: GroupSetting[]
}

interface FilterGroup {
  op: 'and' | 'or'
  conditions: (FilterCondition | FilterGroup)[]
}

interface FilterCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn'
  value: unknown
}

interface GroupSetting {
  field: string
}

interface SortSetting {
  field: string
  direction: 'asc' | 'desc'
}

interface ViewConfig {
  table?: TableViewConfig
}

interface TableViewConfig {
  columns: TableColumnConfig[]
}

interface TableColumnConfig {
  type?: 'column' | 'lookup'
  column?: string
  lookup?: { relation: string; field?: string; agg?: 'count' | 'list' }
  label?: string
  width?: 'auto' | number
  visible?: boolean
  config?: Record<string, unknown>
}

interface QueryPlainProjectionColumn {
  field: string
  as?: string
}

interface QueryLookupProjectionColumn {
  relation: string
  field?: string
  agg?: 'count' | 'list'
  as?: string
}

type QueryProjectionColumn = QueryPlainProjectionColumn | QueryLookupProjectionColumn
```

## APIs

- `GET /api/admin/resource-types/:nsdb` — list resource types
- `GET /api/admin/resource-types/:nsdb/:name` — get a resource type by name
- `GET /api/admin/views/:nsdb?table=` — list views
- `GET /api/admin/views/:nsdb/default/:table` — get default view for table
- `GET /api/admin/views/:nsdb/:id` — get a view
- `POST /api/admin/views/:nsdb` — create a view
- `PATCH /api/admin/views/:nsdb/:id` — update a view
- `DELETE /api/admin/views/:nsdb/:id` — delete a view
- `POST /api/admin/tables/:nsdb/:table/query` — query records with pagination, filter, sort, and projection

Tenant-scoped equivalents exist under `/api/resource-types`, `/api/views` and `/api/tables`.

### Query body

`POST /api/tables/:table/query` and the admin equivalent accept:

```ts
interface QueryBody {
  page?: number
  pageSize?: number
  filter?: FilterGroup
  sort?: SortSetting[]
  columns?: QueryProjectionColumn[]
}
```

- `filter` is translated into a SurrealDB `WHERE` clause.
- `sort` is translated into an `ORDER BY` clause.
- `columns` controls the `SELECT` projection. Plain items become `field AS as`; lookup items reference a `_relations` row by name and are resolved to the correct SurrealDB expression server-side. `id` is always included.
- Unsupported operators or invalid field names are rejected before the query runs.

## Display types

The column schema's `displayType` drives how cells are rendered in table views:

- `tag` — renders the value as a colored pill. Configure per-value colors with `config.tagColors: Record<string, string>` and a fallback with `config.defaultColor`. Used for `companies.status` (`active` = green, `inactive` = red) and `companies.slug` (gray).
- `email` — renders the value as a `mailto:` link. Used for `platform_users.email` and `members.email`.

The full list of supported display types is defined in `packages/shared/src/index.ts` on `ColumnDefinition.displayType`.

## UI

The reusable table UI lives in the `data-table` Nuxt layer (`layers/data-table`) so both `apps/admin` and `apps/web` can use it.

- `layers/data-table/components/DataTableRenderer.vue` renders rows from a view, schema, and rows.
- `layers/data-table/components/ViewRenderer.vue` is the new resource-driven entry point. It loads a resource type, resolves its default view and schema, fetches resource action placements, and renders `DataTableContainer`.
- `layers/data-table/components/DataTableContainer.vue` loads records for a view and renders toolbar + row actions.
- `layers/data-table/components/ActionHost.vue` mounts hidden action components and exposes `trigger(component, method, record)` so row-double-click and other indirect interactions can invoke an action.
- `layers/data-table/components/DataTablePage.vue` (deprecated) loads the default view, schema, and records for a table.
- `apps/admin/app/pages/user-groups/index.vue` renders admin user groups through `ViewRenderer`.
- `apps/admin/app/pages/tables/[table].vue` loads the default (or selected) view and records.
- `apps/admin/app/pages/views/index.vue` lists views per table.
- `apps/admin/app/pages/views/[id].vue` creates or edits a view, including column visibility, ordering, labels, and widths.

## Phase 1 scope

- Table view only.
- Saved filters, sorts, and visible columns are executed on the backend query.
- Toolbar and row actions are driven by per-resource action placement configs.
- No card or kanban views.
- No view-level permissions.

## Future work

- Add card and kanban view renderers.
- Add view visibility/permissions.

## Related

- [[40-Packages/db|DB Package]]
- [[40-Packages/data-table-layer|Data Table Layer]]
- [[30-Apps/Admin/Overview|Admin App]]
- [[30-Apps/Web App/Overview|Web App]]
