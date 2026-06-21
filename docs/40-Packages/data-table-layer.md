---
title: data-table layer
type: package
status: done
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

Deprecated backward-compat wrapper around `DataTable.vue`. Forwards the same props.

### `DataToolbar.vue`

Combines filter, group, sort, column, and settings controls.

### Toolbar pieces

- `DataToolbarFilter` — nested AND/OR filter builder; view-defined filters are read-only unless `canUpdateView`.
- `DataToolbarGroup` — group-by selector.
- `DataToolbarSort` — multi-column sort builder.
- `DataToolbarColumn` — column visibility toggle.
- `DataToolbarSetting` — settings dropdown with schema and permissions links.

## Permissions

- `update_default_view_settings` — shows the **Save view** button and allows editing the view-defined filter.
- `edit_schema` — shows the **Edit schema** settings link.
- `manage_permissions` — shows the **Manage permissions** settings link.

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
