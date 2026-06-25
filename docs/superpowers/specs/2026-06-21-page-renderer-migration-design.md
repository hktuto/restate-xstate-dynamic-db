---
title: PageRenderer migration design
type: note
status: in-progress
area: docs
created: 2026-06-21
updated: 2026-06-25
related:
  - [[50-Features/Resource Actions]]
  - [[50-Features/Views]]
  - [[40-Packages/data-table-layer]]
  - [[30-Apps/Admin App/Overview]]
---

# PageRenderer migration design

## Goal

Replace the legacy `DataTablePage`/`DataTable` components with a resource-driven `PageRenderer` that accepts a JSON config and renders `ViewRenderer`. Add the full data toolbar (search, filter, sort, group, columns, view settings) to `DataTableContainer` so the new stack has feature parity with the old one.

## Scope

- Create `PageRenderer.vue` and `usePageMeta.ts` in `apps/admin/app/composables/`.
- Refactor `apps/admin/app/layouts/default.vue` to render `UDashboardPanel` + `UDashboardNavbar` from `usePageMeta` state.
- Extend `ViewRenderer.vue` and `DataTableContainer.vue` in `layers/data-table/` to support the data toolbar and view saving.
- Migrate three admin list pages from `DataTablePage` to `PageRenderer`:
  - `/companies`
  - `/users`
  - `/workflow-designs`
- Remove `UDashboardPanel`/`UDashboardNavbar` from all other admin pages and replace with `usePageMeta` calls.
- Delete the unused `/tables/[table]` page.
- Delete `DataTable.vue` and `DataTablePage.vue` once all consumers are gone.

## Components

### `PageRenderer.vue`

Location: `apps/admin/app/components/PageRenderer.vue`

Props:

```ts
interface PageConfig {
  resource: string
  view?: string | ViewDefinition
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
}
```

Responsibilities:
- Compute default `schemaEditLink` and `permissionsEditLink` from the resolved namespace and resource table.
- Render `<ViewRenderer>` and pass capability flags through.

The dashboard chrome (`UDashboardPanel`, `UDashboardNavbar`) stays in the layout. Pages set their title/icon through a `usePageMeta({ title, icon })` composable that updates a reactive shared state the layout reads. This supports both static and dynamic titles (e.g. `Schema: companies`).

```vue
<script setup lang="ts">
usePageMeta({ title: 'Companies', icon: 'i-lucide-building-2' })

const config = {
  resource: 'companies',
  canUpdateView: true,
  canEditSchema: true,
  canManagePermissions: true,
}
</script>

<template>
  <PageRenderer :config="config" />
</template>
```

### `ViewRenderer.vue` updates

- Accept optional capability props (`canUpdateView`, `canEditSchema`, `canManagePermissions`) and forward them to `DataTableContainer`.
- Keep loading resource type, view, schema, and action placements.

### `DataTableContainer.vue` updates

- Add data toolbar state:
  - `useDataToolbar(view, canUpdateView)` for runtime/dirty/save.
  - `appliedFilter` and `searchQuery` refs.
- Re-query records when `appliedFilter`, `runtime.sort`, `runtime.columns`, or `searchQuery` change (debounced).
- Render `<DataToolbar>` above the action toolbar/table.
- Handle view save: call the view PATCH endpoint and reload.
- Pass `runtime.columns` to `DataTableRenderer`.

## Page config (phase 1, inline)

Each page calls `usePageMeta` for title/icon and passes a config object to `PageRenderer`:

```vue
<script setup lang="ts">
usePageMeta({ title: 'Companies', icon: 'i-lucide-building-2' })

const config = {
  resource: 'companies',
  canUpdateView: true,
  canEditSchema: true,
  canManagePermissions: true,
}
</script>

<template>
  <PageRenderer :config="config" />
</template>
```

## Data flow

1. Page calls `usePageMeta({ title, icon })` to set layout title/icon.
2. Page renders `<PageRenderer :config="config" />`.
3. `ViewRenderer` loads resource type → default view + schema + action placements.
4. `DataTableContainer` loads records and sets up toolbar state.
5. Toolbar changes update query body; debounced re-fetch updates rows.
6. Save action persists the runtime view and reloads.

## Migration steps

1. Create `usePageMeta.ts` and update `default.vue` layout to render `UDashboardPanel`/`UDashboardNavbar` from its state.
2. Add toolbar support to `DataTableContainer.vue`.
3. Create `PageRenderer.vue`.
4. Update `ViewRenderer.vue` to forward capability props.
5. Migrate `/companies`, `/users`, `/workflow-designs` to `PageRenderer`; verify toolbar/actions/save work.
6. Remove `UDashboardPanel`/`UDashboardNavbar` from all other admin pages and set title/icon via `usePageMeta`.
7. Delete `apps/admin/app/pages/tables/[table].vue`.
8. Delete `layers/data-table/components/DataTable.vue` and `DataTablePage.vue`.
9. Update docs (`data-table-layer.md`, `Views.md`, `Admin App Overview.md`).

## Testing

- Typecheck admin and shared packages.
- Unit tests for `buildQueryBody` with filter/search options (already supported; add coverage if missing).
- Browser smoke test on each migrated page: load, filter, sort, hide column, save view, create/edit/delete actions.

## Out of scope

- Centralized page registry (configs stay inline in phase 1).
- Migrating web/tenant pages (no `DataTablePage` consumers in `apps/web`).
- Card/kanban views.

## Decisions

- View saving enabled on all migrated pages.
- `/tables/[table]` is unused and will be deleted.
- `PageRenderer` lives in `apps/admin` because dashboard chrome is app-specific.
