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
  - [[30-Apps/Admin/Overview]]
  - [[30-Apps/Web App/Overview]]
---

# Views

## Overview

Views are saved presentation presets for a table. A view defines which columns to show, how to order them, and what view type to use. The UI renders a table by loading a view and the table schema, then applies the view config to decide column visibility, labels, and widths.

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
  column: string
  label?: string
  width?: 'auto' | number
  visible?: boolean
}
```

## APIs

- `GET /api/admin/views/:nsdb?table=` — list views
- `GET /api/admin/views/:nsdb/default/:table` — get default view for table
- `GET /api/admin/views/:nsdb/:id` — get a view
- `POST /api/admin/views/:nsdb` — create a view
- `PATCH /api/admin/views/:nsdb/:id` — update a view
- `DELETE /api/admin/views/:nsdb/:id` — delete a view
- `POST /api/admin/tables/:nsdb/:table/query` — query records with pagination, filter, sort, and projection

Tenant-scoped equivalents exist under `/api/views` and `/api/tables`.

### Query body

`POST /api/tables/:table/query` and the admin equivalent accept:

```ts
interface QueryBody {
  page?: number
  pageSize?: number
  filter?: FilterGroup
  sort?: SortSetting[]
  columns?: TableColumnConfig[]
}
```

- `filter` is translated into a SurrealDB `WHERE` clause.
- `sort` is translated into an `ORDER BY` clause.
- `columns` controls the `SELECT` projection; only visible columns plus `id` are returned.
- Unsupported operators or invalid field names are rejected before the query runs.

## Display types

The column schema's `displayType` drives how cells are rendered in table views:

- `tag` — renders the value as a colored pill. Configure per-value colors with `config.tagColors: Record<string, string>` and a fallback with `config.defaultColor`. Used for `companies.status` (`active` = green, `inactive` = red) and `companies.slug` (gray).
- `email` — renders the value as a `mailto:` link. Used for `platform_users.email` and `members.email`.

The full list of supported display types is defined in `packages/shared/src/index.ts` on `ColumnDefinition.displayType`.

## UI

The reusable table UI lives in the `data-table` Nuxt layer (`layers/data-table`) so both `apps/admin` and `apps/web` can use it.

- `layers/data-table/components/TableView.vue` renders rows from a view and schema.
- `layers/data-table/components/DataTablePage.vue` loads the default view, schema, and records for a table. Pass `nsdb` to use admin paths (`/api/admin/...`); omit it to use tenant paths (`/api/...`).
- `apps/admin/app/pages/tables/[table].vue` loads the default (or selected) view and records.
- `apps/admin/app/pages/views/index.vue` lists views per table.
- `apps/admin/app/pages/views/[id].vue` creates or edits a view, including column visibility, ordering, labels, and widths.

## Phase 1 scope

- Table view only.
- Saved filters, sorts, and visible columns are executed on the backend query.
- No row actions.
- No card or kanban views.
- No view-level permissions.

## Future work

- Add card and kanban view renderers.
- Bind row actions to views once the `_actions` catalog is designed.
- Add view visibility/permissions.

## Related

- [[40-Packages/db|DB Package]]
- [[40-Packages/data-table-layer|Data Table Layer]]
- [[30-Apps/Admin/Overview|Admin App]]
- [[30-Apps/Web App/Overview|Web App]]
