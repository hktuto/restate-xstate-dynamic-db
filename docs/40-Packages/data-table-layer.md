---
title: data-table layer
type: package
status: done
area: architecture
created: 2026-06-20
updated: 2026-06-20
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

### `TableView.vue`

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

Full page component that loads the default view, schema, and records for a table.

Props:
- `title: string`
- `icon?: string`
- `table: string`
- `nsdb?: string`
- `newLink?: string`
- `newLabel?: string`

Path behavior:
- If `nsdb` is provided, it calls admin endpoints (`/api/admin/views/:nsdb/default/:table`, `/api/admin/tables/:nsdb/...`).
- If `nsdb` is omitted, it calls tenant endpoints (`/api/views/default/:table`, `/api/tables/...`).

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
