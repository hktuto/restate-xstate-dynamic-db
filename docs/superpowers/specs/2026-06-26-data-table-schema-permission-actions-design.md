---
title: Data Table Schema and Permission Actions
type: note
status: done
area: admin
app:
  - admin
created: 2026-06-26
updated: 2026-06-26
related:
  - [[40-Packages/data-table-layer]]
  - [[50-Features/Resource Actions]]
  - [[50-Features/Views]]
  - [[50-Features/Admin Authentication & Authorization]]
---

# Data Table Schema and Permission Actions

Move the hardcoded “Edit schema” and “Manage permissions” toolbar links into the existing dynamic `ResourceActionPlacement` system. This removes admin-specific concepts from the shared `data-table` layer and makes the toolbar uniform: every affordance is either a built-in view control or a resource action resolved from config.

## Background

The `data-table` layer currently renders a fixed `Settings` dropdown (`DataToolbarSetting.vue`) with two links:

- Edit schema → `/schema/:table?nsdb=...`
- Manage permissions → `/permissions/:table?nsdb=...`

These links are wired through dedicated props (`canEditSchema`, `canManagePermissions`, `schemaEditLink`, `permissionsEditLink`) across `ViewRenderer`, `DataTableContainer`, and `DataToolbar`. Meanwhile, record/resource actions such as `create`, `edit`, and `delete` already flow through the dynamic `ResourceActionPlacement` system and render in the `toolbar-actions` slot.

The permission model binds each resource type to a table (e.g. `admin_user` → `platform_users`). `edit_schema` and `manage_permissions` are standalone bits on those resource types. They are resource-level meta-actions: they protect the resource type/table definition, not individual records.

## Goal

- Render schema and permission links through the same dynamic action system as `create`/`edit`/`delete`.
- Remove the `Settings` dropdown and its special props from the shared layer.
- Keep resource types table-bound; do not refactor the permission catalog structure.
- Document `edit_schema` and `manage_permissions` as resource-level meta-actions.

## Design

### Layer changes

Remove `DataToolbarSetting.vue` and its wiring:

| File | Change |
|------|--------|
| `layers/data-table/components/DataToolbarSetting.vue` | Delete |
| `layers/data-table/components/DataToolbar.vue` | Remove `canEditSchema`, `canManagePermissions`, `schemaEditLink`, `permissionsEditLink` props; remove `<DataToolbarSetting />`; keep the `toolbar-actions` slot and Save view button |
| `layers/data-table/components/DataTableContainer.vue` | Remove the four settings props and the link-builder functions; stop passing them to `DataToolbar` |
| `layers/data-table/components/ViewRenderer.vue` | Remove `canEditSchema` and `canManagePermissions` props |

The toolbar order becomes:

1. Search
2. Filter
3. Group
4. Sort
5. Column
6. Resource actions (`<slot name="toolbar-actions" />`) — now includes schema/permission links when configured
7. Save view

### Admin action components

Add two globally-registered action components under `apps/admin/app/components/actions/common/`:

- `EditSchema.global.vue`
- `ManagePermissions.global.vue`

Each receives an `ActionContext` prop, checks permission via `useAdminPermission().can()`, and renders a `UButton` link:

- Edit schema: `/schema/${encodeURIComponent(table)}?nsdb=${encodeURIComponent(nsdb)}`
- Manage permissions: `/permissions/${encodeURIComponent(table)}?nsdb=${encodeURIComponent(nsdb)}`

These components follow the same contract as other action components: they self-gate based on permission and expect to be rendered directly for `location: 'toolbar'` placements.

### Resource action configs

Add placements to each admin resource config under `apps/admin/app/config/resource-actions/`:

```ts
export const resourceActionPlacements = {
  // ... existing create, edit, delete placements

  edit_schema: [
    { type: ['table'], location: 'toolbar', component: 'EditSchema', method: null },
  ],
  manage_permissions: [
    { type: ['table'], location: 'toolbar', component: 'ManagePermissions', method: null },
  ],
}
```

Resources that should not expose these actions simply omit the entries.

### Admin pages

Each admin index page (`users/index.vue`, `user-groups/index.vue`, `companies/index.vue`, `workflow-designs/index.vue`) stops computing and passing `canEditSchema` / `canManagePermissions` to `ViewRenderer`. The components now handle their own permission checks.

## Data flow

1. `ViewRenderer` loads the resource type, default view, schema, and action placements.
2. `resolveViewActions` maps `edit_schema` and `manage_permissions` placements to `EditSchema` and `ManagePermissions`.
3. `DataTableContainer` renders them in the `toolbar-actions` slot inside `DataToolbar`.
4. The link components read `ActionContext.resourceType`, check permission, and compute the table/nsdb link.

## Permission semantics

`edit_schema` and `manage_permissions` remain standalone bits on each table-bound resource type. They are **resource-level meta-actions**: they grant the ability to change the schema or permission grants for that resource type’s table, not to mutate individual records. This distinction is documented here and should be reflected in the resource catalog comments.

## Error handling

- If a resource config omits the new placements, the buttons do not appear. No runtime error.
- If a page still passes the removed props, Vue warns about unused props; all call sites are updated.
- The link components fall back to the current `nsdb` and `table` from `ActionContext`.

## Testing

- `layers/data-table` component tests: `DataToolbar` no longer renders a Settings dropdown; slotted toolbar actions still render between Column and Save view.
- `resolveViewActions` unit test: verify `edit_schema`/`manage_permissions` placements resolve into `toolbar`.
- Admin app: each resource index page renders the link components only when the permission is granted.

## Files changed

### Shared layer
- `layers/data-table/components/DataToolbar.vue`
- `layers/data-table/components/DataTableContainer.vue`
- `layers/data-table/components/ViewRenderer.vue`
- `layers/data-table/components/DataToolbarSetting.vue` (deleted)

### Admin app
- `apps/admin/app/config/resource-actions/admin_user.ts`
- `apps/admin/app/config/resource-actions/admin_user_group.ts`
- `apps/admin/app/config/resource-actions/company.ts`
- `apps/admin/app/config/resource-actions/workflow_design.ts`
- `apps/admin/app/pages/users/index.vue`
- `apps/admin/app/pages/user-groups/index.vue`
- `apps/admin/app/pages/companies/index.vue`
- `apps/admin/app/pages/workflow-designs/index.vue`
- `apps/admin/app/components/actions/common/EditSchema.global.vue` (new)
- `apps/admin/app/components/actions/common/ManagePermissions.global.vue` (new)

### Docs
- `docs/40-Packages/data-table-layer.md`
- `docs/50-Features/Resource Actions.md`
- `docs/superpowers/specs/2026-06-25-data-table-toolbar-actions-slot-design.md` (update toolbar order table)

## Out of scope

- Changing the permission catalog structure or decoupling resource types from tables.
- Adding schema/permission editing to tenant pages; only admin components are added.
- Reordering or hiding built-in toolbar controls (Search, Filter, Group, Sort, Column).
- Record-scoped schema/permission editing.
