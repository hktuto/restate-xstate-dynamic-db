---
title: data-table layer
type: package
status: in-progress
area: architecture
created: 2026-06-20
updated: 2026-06-21
related:
  - [[Data Model]]
  - [[Multi-tenancy]]
  - [[50-Features/Views]]
  - [[40-Packages/db]]
---

# data-table layer

## Purpose

Shared Nuxt layer for rendering data tables from the `_views` registry. Provides reusable components that work in both the admin app (platform scope) and the web app (tenant scope).

## Location

`layers/data-table`

## Components

### `DataTable.vue`

Container that loads a table's view, schema, and records, then renders the toolbar and table. Permission booleans are passed as props.

Props:
- `table: string`
- `nsdb?: string`
- `title?: string`
- `icon?: string`
- `newLink?: string`
- `newLabel?: string`
- `canUpdateView?: boolean`
- `canEditSchema?: boolean`
- `canManagePermissions?: boolean`

Path behavior:
- If `nsdb` is provided, it calls admin endpoints (`/api/admin/views/:nsdb/default/:table`, `/api/admin/tables/:nsdb/...`).
- If `nsdb` is omitted, it calls tenant endpoints (`/api/views/default/:table`, `/api/tables/...`).

The component builds a runtime view state from the loaded view and passes it to the toolbar. Whenever the runtime state changes (filter, sort, or visible columns), the records are re-queried using `layers/data-table/utils/query-body.ts`.

### `DataTableRenderer.vue`

Renders rows using a `ViewDefinition` and a `TableSchema`.

Props:
- `view: ViewDefinition`
- `schema: TableSchema`
- `rows: Record<string, unknown>[]`

It reads `view.config.table.columns` to decide visibility, labels, order, and widths. It maps each column's `displayType` to a simple cell formatter:

- `text`, `number`, `relation`, `json` — plain text
- `date` — localized date/time
- `checkbox` — "Yes" / "No"
- `email` — clickable `mailto:` link
- `tag` — rounded pill; color is resolved from `column.config.tagColors[value]` with `column.config.defaultColor` fallback
- `select`, `url`, `user`, `formula`, `richText` — plain text for now

### `DataTablePage.vue`

Deprecated backward-compat wrapper around `DataTable.vue`. Forwards the same props and defaults `schemaEditLink` and `permissionsEditLink` to `/schema/:table?nsdb=...` and `/permissions/:table?nsdb=...`.

### `DataToolbar.vue`

Combines filter, group, sort, column, and settings controls.

### Toolbar pieces

- `DataToolbarFilter` — nested AND/OR filter builder; view-defined filters are read-only unless `canUpdateView`. Select-type columns render a dropdown of configured options; the dropdown becomes multi-select when the operator is `in` or `not in`.
- `DataToolbarGroup` — group-by selector (UI only; not sent to the query endpoint).
- `DataToolbarSort` — multi-column sort builder.
- `DataToolbarColumn` — split visible/hidden column lists with drag-and-drop between them and eye-icon toggles.
- `DataToolbarFilter` — auto-adds an empty condition when the popover opens with no conditions.
- `DataToolbarSetting` — settings dropdown with schema and permissions links.

### Query utilities

- `useDataToolbar(view, canUpdateView)` — derives a mutable `RuntimeViewState` from a loaded `ViewDefinition`, tracks dirty state, and produces a saved view.
- `buildQueryBody(runtime, page, pageSize)` — converts runtime state into the `POST /tables/:table/query` request body, omitting empty filter/sort/column arrays.
- `buildRuntimeView(view)` / `mergeRuntimeToView(runtime, view, canUpdateView)` — pure helpers for cloning and merging view state.

## Full-text search

The toolbar search input sends a `search` string to the table query endpoint. The backend searches across non-system, non-hidden text/email/url/richText columns using a case-insensitive `string::contains` clause.

SurrealDB's native full-text search (`DEFINE ANALYZER` + `SEARCH` indexes + `MATCHES`/`search::score`/`search::highlight`) can replace the current substring scan for relevance scoring and keyword highlighting, but it requires adding per-table/per-field search indexes and updating the query builder. Not implemented yet.

## Usage

### Admin page

```vue
<script setup lang="ts">
const config = {
  title: 'Companies',
  icon: 'i-lucide-building-2',
  table: 'companies',
  nsdb: 'platform--admin',
}
</script>

<template>
  <DataTablePage v-bind="config" />
</template>
```

### Tenant page

```vue
<script setup lang="ts">
const config = {
  title: 'Members',
  icon: 'i-lucide-users',
  table: 'members',
}
</script>

<template>
  <DataTablePage v-bind="config" />
</template>
```

## Configuration

Apps extend the layer in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  extends: ['../../layers/workflow-editor', '../../layers/data-table'],
})
```

Both `apps/admin` and `apps/web` extend this layer.

## Dependencies

- `shared` — for `ViewDefinition`, `TableSchema`, and related types.
- `@nuxt/ui` — components are provided by the consuming app.

## Related

- [[50-Features/Views|Views Feature]]
- [[40-Packages/db|DB Package]]
