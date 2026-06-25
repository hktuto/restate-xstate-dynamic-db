---
title: data-table layer
type: package
status: done
area: architecture
created: 2026-06-20
updated: 2026-06-25
related:
  - [[Data Model]]
  - [[Schema Registry Model]]
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

### `ViewRenderer.vue`

Resource-driven entry point. Loads a resource type, its default view and schema, resolves resource action placements, and renders `DataTableContainer`.

Props:
- `resource: string` — resource type name (e.g. `admin_user_group`).
- `view?: string | ViewDefinition` — optional view id or a full view object.

It relies on app-specific overrides of two composables:
- `useNamespace()` — returns `{ namespace, database }`.
- `useResourceActionPlacements()` — returns a loader for resource action placement configs.

### `DataTableContainer.vue`

Loads records for a view and renders the toolbar, table, and row actions. Wires row-double-click to `ActionHost`.

Props:
- `resource: string`
- `table: string`
- `nsdb: string`
- `scope: 'admin' | 'tenant'`
- `schema: TableSchema`
- `view: ViewDefinition`
- `actions: ResolvedActions`
- `canUpdateView?: boolean`
- `canEditSchema?: boolean`
- `canManagePermissions?: boolean`

### `ActionHost.vue`

Mounts hidden action components and exposes `trigger(component, method?, record?)` so indirect interactions (e.g. row double-click) can invoke an action method with an optional per-row context.

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
- `buildQueryBody(runtime, schema, page, pageSize)` — converts runtime state into the `POST /tables/:table/query` request body, omitting empty filter/sort/column arrays.
- `buildRuntimeView(view)` / `mergeRuntimeToView(runtime, view, canUpdateView)` — pure helpers for cloning and merging view state.
- `resolveViewActions(viewType, bindings, resourcePlacements)` — maps a view's action bindings to concrete component placements.

## Resource action placements

Resource-specific actions are declared in `app/config/resource-actions/<resource>.ts`. Each action maps to one or more placements:

```ts
export const resourceActionPlacements = {
  create: [
    { type: ['table'], location: 'toolbar', component: 'CreateButton', method: null },
  ],
  edit_info: [
    { type: ['table'], location: 'item-contextMenu', component: 'EditAction', method: 'open' },
    { type: ['table'], location: 'item-rowDoubleClick', component: 'EditAction', method: 'open' },
  ],
}
```

- `type` — which view types the placement applies to (`table` for now).
- `location` — `toolbar`, `item-contextMenu`, `item-rowDoubleClick`, or a wildcard like `item-*`.
- `component` — the Vue component name that handles the action.
- `method` — method to call on the component for indirect triggers (`null` for direct-render buttons).

Action components receive an `ActionContext` prop and expose their trigger method via `defineExpose`. Toolbar placements render the component directly; row actions render inline; double-click actions are invoked through `ActionHost`.

## Full-text search

The toolbar search input sends a `search` string to the table query endpoint. The backend searches across non-system, non-hidden text/email/url/richText columns using a case-insensitive `string::contains` clause.

SurrealDB's native full-text search (`DEFINE ANALYZER` + `SEARCH` indexes + `MATCHES`/`search::score`/`search::highlight`) can replace the current substring scan for relevance scoring and keyword highlighting, but it requires adding per-table/per-field search indexes and updating the query builder. Not implemented yet.

## Lookup columns

Lookup columns are virtual view columns that fetch a field from a related record. They are stored in the view config, not in `_columns`, so the schema stays 1:1 with the table.

```ts
interface TableColumnConfig {
  type?: 'column' | 'lookup'
  column?: string
  lookup?: { relation: string; field?: string; agg?: 'count' | 'list' }
  label?: string
  width?: 'auto' | number
  visible?: boolean
  config?: Record<string, unknown>
}
```

The frontend translates a lookup column into a structured query projection column. Examples:

- Reference lookup: `{ relation: 'companyId', field: 'name' }` → `{ relation: 'companyId', field: 'name', as: 'Company' }`
- Graph list lookup: `{ relation: 'groups', field: 'name', agg: 'list' }` → `{ relation: 'groups', field: 'name', agg: 'list', as: 'Groups' }`
- Graph count lookup: `{ relation: 'members', agg: 'count' }` → `{ relation: 'members', agg: 'count', as: 'Members count' }`

The backend query builder resolves the relation from the schema and emits the corresponding SurrealDB projection (e.g. `companyId.name`, `->edge->table.field`, or `count(<-edge<-table)`). Results are rendered using the alias as the result key; `list` aggregates are rendered as comma-separated values.

For the core model behind lookup columns, see [[Schema Registry Model]].

## Usage

### Resource-driven admin page

Admin pages should use the app-specific `PageRenderer` wrapper, which resolves permission booleans via `useResourceCapabilities` and sets page chrome via `usePageMeta`.

```vue
<script setup lang="ts">
usePageMeta({ title: 'User Groups', icon: 'i-lucide-users' })

const config = useResourceCapabilities('admin_user_group')
</script>

<template>
  <PageRenderer :config="config" />
</template>
```

`PageRenderer` is defined in `apps/admin/app/components/PageRenderer.vue` and forwards the capabilities config to the layer's `ViewRenderer`.

For tenant pages, use `ViewRenderer` directly and supply the permission booleans yourself:

```vue
<template>
  <ViewRenderer resource="members" />
</template>
```

The app must provide:

- A resource type record in the catalog with `table` and `resourceType` on its default view.
- A resource action placement config under `app/config/resource-actions/<resource>.ts`.
- Action components registered so their names match the `component` values in the config.

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
