---
title: Data Table Toolbar Actions Slot
type: note
status: planned
area: workflow
app:
  - admin
  - web
created: 2026-06-25
updated: 2026-06-25
related:
  - [[40-Packages/data-table-layer]]
  - [[50-Features/Resource Actions]]
  - [[50-Features/Views]]
---

# Data Table Toolbar Actions Slot

Move resource actions such as **Create** into the `DataToolbar` row by adding a single Vue slot, while keeping the existing action-component contract unchanged.

## Goal

- Render resource actions (create, bulk actions, etc.) inside the same toolbar row as Search / Filter / Group / Sort / Column.
- Avoid turning `DataToolbar` into a dynamic `component :is` registry, because Filter, Group, Sort, and Column need tight two-way binding with `DataTableContainer`.
- Keep action permission checks inside action components, just like today.
- Leave the door open for future per-view toolbar customization without redesign.

## Current state

```
DataTableContainer
├── DataToolbar          # fixed controls only
│   ├── Search
│   ├── Filter
│   ├── Group
│   ├── Sort
│   ├── Column
│   ├── Settings
│   └── Save view
├── <div>actions.toolbar</div>   # resource actions rendered here, below toolbar
└── DataTableRenderer
```

Resource actions are resolved from `ResourceActionPlacement` configs and rendered in `DataTableContainer` as Vue components that receive an `ActionContext`.

## Target state

```
DataTableContainer
└── DataToolbar
    ├── Search
    ├── Filter
    ├── Group
    ├── Sort
    ├── Column
    ├── Settings
    ├── <slot name="toolbar-actions" />   # resource actions rendered here
    └── Save view
```

## Design

### `DataToolbar.vue`

Add one slot between the Settings control and the Save-view button:

```vue
<DataToolbarSetting ... />
<slot name="toolbar-actions" />
<UButton v-if="canUpdateView && dirty" ...>Save view</UButton>
```

No new props, no new emits. The slot receives whatever `DataTableContainer` passes in.

### `DataTableContainer.vue`

Move the existing toolbar-actions block into the slot:

```vue
<DataToolbar ...>
  <template #toolbar-actions>
    <component
      v-for="action in actions.toolbar"
      :key="action.component"
      :is="action.component"
      :context="buildActionContext(action.action)"
    />
  </template>
</DataToolbar>
```

Remove the separate `<div v-if="actions.toolbar.length">` block that currently sits below `DataToolbar`.

Action components keep the same `ActionContext` prop and handle their own permission checks.

### Toolbar order and permissions (default items)

Built-in controls keep a fixed order and the existing permission gates:

| Control | Visible | Mutable |
|---|---|---|
| Search | always | always |
| Filter | always | view-defined filter is locked unless `canUpdateView`; user-added conditions are editable |
| Group | always | always |
| Sort | always | always |
| Column | always | always |
| Settings | `canEditSchema \|\| canManagePermissions` | links enabled per permission |
| Resource actions (slot) | rendered by resource placement config | each component checks its own permission |
| Save view | `canUpdateView && dirty` | `canUpdateView` |

If `canUpdateView` is false, filter/group/sort/column changes stay in runtime state and are lost on navigation, matching current behavior.

## Data flow

1. `ViewRenderer` loads resource placements.
2. `resolveViewActions` maps bindings to concrete components.
3. `DataTableContainer` passes `actions.toolbar` into `DataToolbar` via the slot.
4. Action components receive `ActionContext` and decide visibility/enablement internally.

No changes to `ResourceActionPlacement`, `ViewActionBindings`, `ActionContext`, or the permission system.

## Error handling

- Action load failures are surfaced by `ViewRenderer` / `DataTableContainer` as today.
- Action component permission failures degrade to hidden/disabled buttons, unchanged.

## Testing

- Component test: `DataToolbar` renders slotted content between Settings and Save view.
- Component test: `DataTableContainer` passes `actions.toolbar` into the slot and no longer renders a separate actions row.
- Existing action-component tests remain valid because the `ActionContext` contract does not change.

## Files changed

- `layers/data-table/components/DataToolbar.vue`
- `layers/data-table/components/DataTableContainer.vue`

## Out of scope

- Per-view reordering or hiding of built-in toolbar items.
- New permission gates for Group / Sort / Column beyond the existing `canUpdateView` behavior.
- Changing how row actions (`item-contextMenu`) or row-double-click actions work.
