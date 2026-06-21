---
title: Data Table Toolbar — Filter, Group, Sort, and Settings
type: note
status: in-progress
area: docs
created: 2026-06-21
updated: 2026-06-21
related:
  - [[40-Packages/data-table-layer]]
  - [[50-Features/Views]]
  - [[20-Architecture/Authentication & Authorization]]
---

# Data Table Toolbar — Filter, Group, Sort, and Settings

Add a general-purpose toolbar to the `data-table` layer that exposes filter, group, sort, and view-setting controls. Controls are gated by permissions: some capabilities are always available while editing the underlying view requires `update_default_view_settings`.

## Goal

- Provide reusable toolbar components for the `data-table` layer.
- Support nested AND/OR filters, group-by, multi-column sort, and column visibility/order/width.
- Gate view persistence behind `update_default_view_settings`.
- Gate settings links (schema editor, permissions) behind `edit_schema` and `manage_permissions`.
- Keep `DataTablePage.vue` as a backward-compatibility wrapper while introducing a new `DataTable` container component.

## Architecture

```
layers/data-table/
├── components/
│   ├── DataTable.vue             # container: loads data, permissions, renders toolbar + renderer
│   ├── DataTableRenderer.vue     # pure table renderer (renamed from TableView)
│   ├── DataTablePage.vue         # backward-compat wrapper around DataTable
│   ├── DataToolbar.vue           # toolbar wrapper combining the pieces
│   ├── DataToolbarFilter.vue     # nested AND/OR filter builder
│   ├── DataToolbarGroup.vue      # group-by selector
│   ├── DataToolbarSort.vue       # multi-column sort
│   ├── DataToolbarColumn.vue     # column visibility / order / width
│   └── DataToolbarSetting.vue    # settings dropdown (schema + permissions links)
├── composables/
│   └── useDataToolbar.ts         # state helper extracted from DataToolbar
└── types.ts                      # filter/group runtime types
```

### Container responsibilities

`DataTable.vue` becomes the new core container. It:

1. Accepts `table` and optional `nsdb` props.
2. Loads the default view + schema from the views API.
3. Loads records from the table query API.
4. Receives permission booleans (`canUpdateView`, `canEditSchema`, `canManagePermissions`) and settings links (`schemaEditLink`, `permissionsEditLink`) as props.
5. Renders `DataToolbar` + `DataTableRenderer`.
6. Handles the `save` event and calls the views API.

`DataTablePage.vue` remains as a thin wrapper so existing admin pages keep working without changes. It is deprecated and will be removed once all consumers are migrated to `DataTable.vue`.

```mermaid
flowchart TD
    A[apps/admin/pages/tables/[table].vue] -->|uses| B[DataTablePage.vue]
    B -->|wraps| C[DataTable.vue]
    C -->|loads view/schema/rows| D[(SurrealDB via API)]
    C -->|checks| E[useAdminPermission]
    C -->|renders| F[DataToolbar.vue]
    C -->|renders| G[DataTableRenderer.vue]
    F -->|contains| H[DataToolbarFilter]
    F -->|contains| I[DataToolbarGroup]
    F -->|contains| J[DataToolbarSort]
    F -->|contains| K[DataToolbarColumn]
    F -->|contains| L[DataToolbarSetting]
    F -->|emits save| C
```

## Data model extensions

The `_views` table already stores `group` and `filter` as JSON, but the shared `ViewDefinition` type only exposes `sort`. Extend `packages/shared/src/index.ts`:

```ts
export interface FilterCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn'
  value: unknown
}

export interface FilterGroup {
  op: 'and' | 'or'
  conditions: (FilterCondition | FilterGroup)[]
}

export interface GroupSetting {
  field: string
}

export interface ViewDefinition {
  id?: string
  table: string
  type: 'table'
  name: string
  description?: string
  isDefault?: boolean
  config: ViewConfig
  filter?: FilterGroup
  group?: GroupSetting[]
  sort?: SortSetting[]
}
```

- `FilterGroup` is recursive for nested AND/OR.
- `GroupSetting` is an array to allow future multi-level grouping.
- These shapes are stored directly in `_views.filter` and `_views.group`.

## Component API

### `DataTable.vue`

```ts
interface Props {
  table: string
  nsdb?: string
  title?: string
  icon?: string
  newLink?: string
  newLabel?: string
}
```

No emits; the container handles its own save internally.

### `DataTableRenderer.vue`

Same props as the old `TableView`:

```ts
interface Props {
  view: ViewDefinition
  schema: TableSchema
  rows: Record<string, unknown>[]
}
```

### `DataToolbar.vue`

```ts
interface Props {
  view: ViewDefinition
  schema: TableSchema
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
}

const emit = defineEmits<{
  save: [view: ViewDefinition]
}>()
```

### Small toolbar components

```ts
// DataToolbarFilter
interface Props {
  modelValue: FilterGroup
  schema: TableSchema
  lockedFilter?: FilterGroup
}

// DataToolbarGroup
interface Props {
  modelValue: GroupSetting[]
  schema: TableSchema
}

// DataToolbarSort
interface Props {
  modelValue: SortSetting[]
  schema: TableSchema
}

// DataToolbarColumn
interface Props {
  modelValue: TableColumnConfig[]
  schema: TableSchema
}

// DataToolbarSetting
interface Props {
  canEditSchema?: boolean
  canManagePermissions?: boolean
  schemaEditLink?: string
  permissionsEditLink?: string
}
```

## Permission gating

The toolbar receives booleans from the parent; it does not call the permission system directly.

| Capability | Visible if | Mutable if |
|---|---|---|
| Filter controls | table is being viewed | view-defined filter is locked unless `canUpdateView`; users can always add new conditions |
| Group | table is being viewed | always |
| Sort | table is being viewed | always |
| Column visibility/order/width | table is being viewed | always |
| Settings menu | `canEditSchema \|\| canManagePermissions` | links enabled per permission |
| Save view button | `canUpdateView && dirty` | `canUpdateView` |

If `canUpdateView` is false, the **Save view** button is hidden. Sort/group/column changes stay in runtime state and are lost on navigation.

## Data flow and saving

1. **Load** — `DataTable` fetches `view` + `schema` + rows.
2. **Initialize runtime state** — `DataToolbar` clones `view.filter`, `view.group`, `view.sort`, and `view.config.table.columns` into local refs.
3. **User edits** — small components mutate runtime state via `v-model`.
4. **Dirty detection** — `DataToolbar` compares runtime state to the original `view` with a deep equality check.
5. **Save** — when a permitted user clicks **Save view**, the toolbar emits `save(view)` with a cloned `ViewDefinition` where runtime state is merged back in.
6. **Persist** — `DataTable` calls the views API and reloads the view.

For filters, the merged result is `runtimeFilter = lockedFilter + userAddedConditions`. When saved, the whole runtime filter becomes the new `view.filter`.

## Error handling

- **Load errors** — `DataTable` shows the existing error banner and hides the toolbar.
- **Permission failures** — each `await can(...)` defaults to `false` on failure; the UI degrades gracefully.
- **Save errors** — `DataTable` catches the API call, shows an inline error next to **Save view**, and leaves runtime state intact for retry.
- **Invalid filter state** — `DataToolbarFilter` prevents saving empty conditions and highlights them.
- **Schema mismatch** — unknown columns are skipped by `DataTableRenderer` and shown as disabled in `DataToolbarColumn`.

## Testing

- **Unit tests** for filter/group type recursion and locked/user-added filter merging.
- **Component tests** for each toolbar piece:
  - Locked filter conditions cannot be removed.
  - New filter conditions can be added.
  - Save button visibility respects `canUpdateView`.
  - Settings menu links respect `canEditSchema` and `canManagePermissions`.
- **Integration test** for `DataTable` using mocked `useApi` and permission composable.

## Migration

- Rename `TableView.vue` to `DataTableRenderer.vue` and update its imports.
- Create `DataTable.vue` as the new container.
- Rewrite `DataTablePage.vue` to forward props to `DataTable.vue`.
- Update admin page imports if they reference `TableView` directly (none were found during exploration).
