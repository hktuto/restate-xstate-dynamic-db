---
title: Data Table Toolbar Enhancements — Filter Apply & Draggable Column Reorder
type: note
status: in-progress
area: docs
created: 2026-06-21
updated: 2026-06-21
related:
  - [[2026-06-21-data-table-toolbar-design]]
  - [[40-Packages/data-table-layer]]
  - [[50-Features/Views]]
---

# Data Table Toolbar Enhancements — Filter Apply & Draggable Column Reorder

Extend the `data-table` toolbar so filter changes require an explicit **Apply** before refreshing records, and so column order can be changed by dragging.

## Goal

1. **Filter Apply button** — Users can edit complex filters without triggering a record query on every keystroke/change. Sort and columns remain reactive (refresh immediately).
2. **Draggable columns** — Users can reorder visible columns by dragging them in the Columns popover.

## Design decisions

- The filter popover stays open after Apply (user preference).
- `runtime.filter` remains the draft/source of truth for the toolbar; dirty detection and Save view operate on the draft.
- A separate `appliedFilter` ref in `DataTable.vue` drives the actual query.
- Sort and columns still trigger `loadRecords()` immediately via their existing reactive watchers.
- Column dragging uses `@vueuse/sortable` + `sortablejs` for smoother UX, accepted despite the new dependency.

## Architecture

```
DataTable.vue
├── runtime.filter        # draft edited by DataToolbarFilter
├── appliedFilter         # filter that is actually sent to the query API
├── runtime.sort          # reactive, triggers query
├── runtime.columns       # reactive, triggers query
└── loadRecords()         # uses appliedFilter + runtime.sort + runtime.columns

DataToolbarFilter.vue
├── v-model: runtime.filter
├── @apply -> DataTable.vue
└── Apply button

DataToolbarColumn.vue
├── useSortable(listEl, columns)
├── v-model: runtime.columns
└── visible toggle per column
```

## Data flow

1. **Initial load** — `DataTable` loads view/schema, `useDataToolbar` builds `runtime`, and `DataTable` initializes `appliedFilter = clone(runtime.filter)`.
2. **Filter edits** — `DataToolbarFilter` mutates `runtime.filter`. No query is fired.
3. **Apply** — `DataToolbarFilter` emits `apply`. `DataTable` copies `runtime.filter` into `appliedFilter` and calls `loadRecords()`. Popover stays open.
4. **Sort/column edits** — Watchers on `runtime.sort` and `runtime.columns` call `loadRecords()` immediately.
5. **Save view** — `dirty` compares `runtime` to the saved view, so unapplied filter changes still show **Save view**. The saved view stores the draft filter; on next load it becomes the initial applied filter.

## Component API changes

### `DataTable.vue`

Adds internal state only; no new props or emits.

```ts
const appliedFilter = ref<FilterGroup>({ op: 'and', conditions: [] })
```

`buildQueryBody` is updated to accept the applied filter instead of `runtime.filter`.

### `DataToolbarFilter.vue`

New emit:

```ts
const emit = defineEmits<{
  'update:modelValue': [FilterGroup]
  apply: []
}>()
```

UI adds an **Apply** button at the bottom of the popover content.

### `DataToolbarColumn.vue`

No API change. Internally wraps the column list with `useSortable` from `@vueuse/integrations/useSortable`.

```ts
import { useSortable } from '@vueuse/integrations/useSortable'

const listEl = ref<HTMLElement | null>(null)
useSortable(listEl, columns, {
  animation: 150,
  onUpdate: () => { /* list already reordered via v-model */ },
})
```

## Dependencies

Add to `layers/data-table/package.json`:

```json
{
  "dependencies": {
    "@vueuse/integrations": "^14.0.0",
    "sortablejs": "^1.15.0"
  },
  "devDependencies": {
    "@types/sortablejs": "^1.15.0"
  }
}
```

Then run `pnpm install`.

## Error handling

- **Empty/incomplete filter on Apply** — The backend query builder already ignores conditions with empty fields or operators, so Apply is safe even if the user added a blank condition.
- **Sortable errors** — Fallback to non-draggable list if `useSortable` fails to initialize.

## Testing

- Unit test: `DataTable.vue` does **not** call `loadRecords` when `runtime.filter` changes, but **does** call it when `appliedFilter` changes.
- Unit test: `DataTable.vue` calls `loadRecords` when `runtime.sort` or `runtime.columns` change.
- Component test: clicking Apply emits the apply event.
- Component test: dragging a column in `DataToolbarColumn` reorders the array.

## Files changed

- `layers/data-table/components/DataTable.vue`
- `layers/data-table/components/DataToolbarFilter.vue`
- `layers/data-table/components/DataToolbarColumn.vue`
- `layers/data-table/package.json`
- `pnpm-lock.yaml`
