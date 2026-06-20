---
title: Admin UI Dashboard Layout and Login Page
type: note
status: in-progress
area: docs
created: 2026-06-19
updated: 2026-06-20
related:
  - [[Admin]]
  - [[Nuxt UI]]
---

# Admin UI Dashboard Layout and Login Page

## Goal

Reskin the `apps/admin` interface using Nuxt UI v4 dashboard components. Add a collapsible left sidebar with the agreed site map, a public auth layout for `/login`, and placeholder pages for Companies, Users, and Settings. Remove the Triggers page.

## Non-goals

- Functional data fetching for Companies/Users/Settings (placeholders only).
- Runtime changes to authentication logic beyond the existing cookie guard.
- Dark/light theme toggle or user-profile menus.
- Sub-menus in the sidebar.

## Design

### 1. Layout architecture

Use Nuxt UI v4 dashboard components in `apps/admin/app/layouts/default.vue`:

- `UDashboardGroup` as the root wrapper.
- `UDashboardSidebar` on the left, `collapsible`, with the app logo/name in the header.
- `UNavigationMenu orientation="vertical"` inside the sidebar body for navigation links.
- `UDashboardPanel` as the main content area.
- `UDashboardNavbar` inside the panel header for page titles and the mobile sidebar toggle.
- A logout `UButton` in the sidebar footer.

The existing `auth.vue` layout stays minimal: a centered content area on a neutral background.

### 2. Sidebar navigation

Top-level items only, in this order:

| Label            | Route                |
|------------------|----------------------|
| Dashboard        | `/dashboard`         |
| Companies        | `/companies`         |
| Users            | `/users`             |
| Settings         | `/settings`          |
| Workflow Designs | `/workflow-designs`  |
| Health           | `/health`            |

Each item uses a Lucide icon via the `icon` property.

### 3. Dashboard route and redirect

- The dashboard lives at `/dashboard` (`apps/admin/app/pages/dashboard/index.vue`).
- The root `/` (`apps/admin/app/pages/index.vue`) redirects to `/dashboard` using `navigateTo` so the "home" page can be changed later without touching the sidebar.
- The existing dashboard stats content moves from `pages/index.vue` to `pages/dashboard/index.vue`.

### 4. Login page

`apps/admin/app/pages/login.vue` uses the `auth` layout and Nuxt UI form components:

- `UCard` with title "Sign in" and description.
- `UForm` with `:state` and `@submit`.
- `UFormField` for Email and Password.
- `UInput type="email"` and `UInput type="password"`.
- `UButton type="submit" block` labeled "Sign in".
- `UAlert` for API/login errors.

The login API call and post-login redirect to `/dashboard` remain unchanged.

### 5. New placeholder pages

Create these pages with a `UDashboardPanel` + `UDashboardNavbar` and a placeholder card:

- `apps/admin/app/pages/companies/index.vue`
- `apps/admin/app/pages/companies/[id].vue`
- `apps/admin/app/pages/users/index.vue`
- `apps/admin/app/pages/users/[id].vue`
- `apps/admin/app/pages/settings/index.vue`

Each placeholder uses `UCard` with title and description text.

### 6. Pages to modify

- `apps/admin/app/layouts/default.vue` — replace the top navigation bar with the dashboard sidebar layout.
- `apps/admin/app/layouts/auth.vue` — no functional change; keep as the centered public layout.
- `apps/admin/app/pages/login.vue` — rewrite with Nuxt UI components.
- `apps/admin/app/pages/index.vue` — redirect to `/dashboard`.
- `apps/admin/app/pages/dashboard/index.vue` — move existing dashboard content here.

### 7. Pages to remove

- `apps/admin/app/pages/triggers/index.vue` and the `triggers/` directory.

### 8. Auth middleware

`apps/admin/app/middleware/auth.global.ts` stays as-is: redirects unauthenticated users to `/login`, allows `/login` and `/api/*`.

### 9. Nuxt UI components used

- Layout: `UDashboardGroup`, `UDashboardSidebar`, `UDashboardPanel`, `UDashboardNavbar`, `UNavigationMenu`
- Form/elements: `UForm`, `UFormField`, `UInput`, `UButton`, `UCard`, `UAlert`

## Dependencies

- `apps/admin/app/layouts/default.vue`
- `apps/admin/app/layouts/auth.vue`
- `apps/admin/app/pages/login.vue`
- `apps/admin/app/pages/index.vue`
- `apps/admin/app/pages/dashboard/index.vue`
- `apps/admin/app/pages/companies/index.vue`
- `apps/admin/app/pages/companies/[id].vue`
- `apps/admin/app/pages/users/index.vue`
- `apps/admin/app/pages/users/[id].vue`
- `apps/admin/app/pages/settings/index.vue`
- `apps/admin/app/pages/triggers/index.vue` (delete)
- `apps/admin/app/middleware/auth.global.ts` (no change)

## Testing plan

1. Run `pnpm --filter admin typecheck` and confirm no errors.
2. Run `pnpm --filter admin dev` and verify:
   - Sidebar renders with all six items.
   - Sidebar collapses/toggles on desktop and mobile.
   - `/` redirects to `/dashboard`.
   - `/login` renders the Nuxt UI login card.
   - `/companies`, `/companies/1`, `/users`, `/users/1`, `/settings` render placeholder content.
   - `/triggers` returns a 404.
3. Verify that unauthenticated access to any protected route still redirects to `/login`.

## Success criteria

- Admin app uses Nuxt UI dashboard layout with a collapsible sidebar.
- Sidebar contains only the six agreed top-level items.
- Dashboard is available at `/dashboard` and `/` redirects there.
- Login page is built with Nuxt UI form/card components.
- Placeholder pages exist for Companies, Users, and Settings.
- Triggers page is removed.
- `pnpm --filter admin typecheck` passes.
