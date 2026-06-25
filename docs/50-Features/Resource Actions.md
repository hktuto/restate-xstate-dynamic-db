---
title: Resource Actions
type: feature
status: planned
area: workflow
created: 2026-06-21
updated: 2026-06-25
related:
  - [[50-Features/Views]]
  - [[40-Packages/data-table-layer]]
  - [[Tenant Permission System]]
  - [[Admin Authentication & Authorization]]
---

# Resource Actions

## Overview

Resource actions bind permissions, UI placement, and behavior for a resource type. Instead of hard-coding buttons and row menus per page, each resource declares where its actions appear and which component handles them. The data-table layer then renders the actions and wires events like row double-click.

## Concepts

- **Resource type** — a catalog entry such as `admin_user_group` that defines the table, available permission actions, and default groups.
- **Action placement** — a config object that says an action appears in the toolbar, a row context menu, or on row double-click, and which component implements it.
- **Action component** — a Vue component that receives an `ActionContext`, checks permission via `useAdminPermission().can()` (or the tenant equivalent), and exposes a trigger method for indirect invocation.
- **Action binding** — a view can override which actions appear and where; if omitted, default bindings are derived from the resource placements.

## Placement schema

```ts
interface ResourceActionPlacement {
  type: string[]
  location: string
  component: string
  method?: string | null
}
```

Example config for `admin_user_group`:

```ts
export const resourceActionPlacements = {
  create: [
    { type: ['table'], location: 'toolbar', component: 'CreateAdminUserGroupButton', method: null },
  ],
  edit_info: [
    { type: ['table'], location: 'item-contextMenu', component: 'EditAdminUserGroupAction', method: 'open' },
    { type: ['table'], location: 'item-rowDoubleClick', component: 'EditAdminUserGroupAction', method: 'open' },
  ],
  delete: [
    { type: ['table'], location: 'item-contextMenu', component: 'DeleteAdminUserGroupAction', method: 'open' },
  ],
}
```

Action names must match permission actions defined in the resource catalog.

## UI flow

1. A page renders `<PageRenderer :config="useResourceCapabilities('admin_user_group')" />` (or uses `ViewRenderer` directly for custom cases).
2. `ViewRenderer` loads the resource type record, default view, schema, and action placements.
3. `DataTableContainer` loads records and renders toolbar/row actions from the resolved placements.
4. `ActionHost` mounts hidden action components for indirect triggers such as row double-click.

## Component registration

Action component names in placement configs must match the names Nuxt registers. To keep nested components from picking up directory prefixes, the admin app configures `components` with `pathPrefix: false`:

```ts
components: [
  { path: '~/components', pathPrefix: false },
]
```

## Permission check

Action components call the permission system with the action name from the catalog:

```ts
const allowed = await can(resourceType, 'edit_info', record?.id)
```

## Status

Phase 1 is implemented for the admin `/user-groups`, `/users`, `/workflow-designs`, and `/companies` (edit only) pages. Tenant pages can follow the same pattern using tenant-scoped permissions and endpoints.

## Related

- [[50-Features/Views|Views Feature]]
- [[40-Packages/data-table-layer|Data Table Layer]]
