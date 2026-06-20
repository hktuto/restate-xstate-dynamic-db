---
title: Admin Sidebar Layout Refinement
type: note
status: in-progress
area: docs
created: 2026-06-20
updated: 2026-06-20
---

# Admin Sidebar Layout Refinement

## Goal

Update the `apps/admin` dashboard sidebar to match the Nuxt UI dashboard template by adding:

1. A user-profile popover menu in the sidebar footer.
2. A sidebar expand/collapse toggle in the sidebar header.

## Scope

Only `apps/admin/app/layouts/default.vue` will be modified. No new pages or routes are required, although a placeholder `/users/me` route may be referenced for the Profile menu item.

## Design

### Sidebar header

- Keep the existing “SuperAdmin” brand link aligned to the left.
- Add `<UDashboardSidebarCollapse variant="subtle" />` to the right side of the `#header` slot.
- This component is provided by Nuxt UI and automatically controls the sidebar’s collapsed state when the sidebar is `collapsible`.

### Sidebar footer

- Replace the current plain “Logout” `<UButton>` with a profile popover trigger.
- The trigger is a `<UButton>` containing:
  - An avatar (placeholder src).
  - The display name “Admin User” (visible only when the sidebar is expanded).
  - A trailing chevron icon (visible only when expanded).
- Wrap the trigger in a `<UPopover>` that renders a small vertical menu:
  - **Profile** → navigates to `/users/me` (or `/settings` if no profile page exists yet).
  - **Settings** → navigates to `/settings`.
  - Divider.
  - **Logout** → calls the existing `logout()` handler (`POST /api/admin/logout`) and redirects to `/login`.

### Collapsed-state handling

- Use the `collapsed` slot prop exposed by `UDashboardSidebar` in both `#header` and `#footer`.
- When collapsed, the footer trigger shows only the avatar and no label/chevron.
- The popover content remains the same regardless of collapsed state.

### Accessibility / UX

- The popover trigger is a real button and remains keyboard-focusable.
- Menu items use clear labels and standard navigation via `<NuxtLink>` or click handlers.
- The collapse toggle uses Nuxt UI’s built-in accessible behavior.

## Decisions

- Profile popover items: Profile, Settings, Logout.
- Collapse toggle: use built-in `UDashboardSidebarCollapse` (variant `subtle`) rather than a custom-managed `collapsed` ref.
- Display name and avatar are hard-coded placeholders; later work can wire them to the authenticated user endpoint.
