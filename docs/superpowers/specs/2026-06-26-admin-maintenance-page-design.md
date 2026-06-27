---
title: Admin Maintenance Page
type: note
status: done
area: admin
app:
  - admin
created: 2026-06-26
updated: 2026-06-26
related:
  - [[30-Apps/Admin App/Overview|Admin App Overview]]
  - [[50-Features/Admin Authentication & Authorization]]
  - [[40-Packages/shared-api|shared-api layer]]
---

# Admin Maintenance Page

Add a maintenance page to the admin app and redirect users there when any API call returns a 5xx server error. The page lets the user return to the original URL or open the health monitor's HTML status page in a new tab.

## Background

The admin app uses `layers/shared-api/composables/useApi.ts` for all API calls. It currently intercepts 401 responses and redirects to `/login`, but it does not handle 5xx errors. When the API or a downstream service is unavailable, the user sees inline errors or a broken page.

The `apps/health-monitor` package already exposes an HTML status page at `/status` on `HEALTH_MONITOR_PORT` (default 3010). This page shows the latest health checks for surrealdb, restate, workflow-runtime, and api.

## Goal

- Detect HTTP 5xx responses in `useApi` and redirect to `/maintenance?redirect=<current-url>`.
- Add `/maintenance` page with a clear message and two actions:
  - **Go back** — return to the original URL from the `redirect` query param.
  - **Check system status** — open the health monitor `/status` page in a new tab.
- Configure the health monitor URL via runtime config.

## Design

### `useApi` interceptor

In `layers/shared-api/composables/useApi.ts`, extend `onResponseError` after the existing 401 handling:

```ts
if (response?.status && response.status >= 500 && response.status <= 599) {
  if (!window.location.pathname.startsWith('/maintenance')) {
    window.location.href = '/maintenance?redirect=' + encodeURIComponent(window.location.href)
  }
}
```

Because the admin app sets `ssr: false`, the interceptor runs only in the browser and can use `window.location.href` directly. No `import.meta.client` guard or `navigateTo` is needed.

### Maintenance page

Create `apps/admin/app/pages/maintenance.vue` using the existing `auth` layout:

- Read the `redirect` query param.
- Validate and sanitize it: reject non-string values and URLs whose path is `/maintenance` to avoid a redirect loop. Default to `/dashboard`.
- Read `healthMonitorUrl` from public runtime config and build `${healthMonitorUrl}/status`.
- Render:
  - A construction/warning icon.
  - Title: "Service temporarily unavailable".
  - Subtext explaining the platform is experiencing issues.
  - "Go back" button that sets `window.location.href = redirect`.
  - "Check system status" link that opens the health monitor status page in a new tab (hidden if `healthMonitorUrl` is not configured).

### Runtime config

In `apps/admin/nuxt.config.ts`, add to `runtimeConfig.public`:

```ts
healthMonitorUrl: process.env.HEALTH_MONITOR_URL ?? 'http://localhost:3010',
```

In `.env.example`, add under the health-monitor section:

```env
HEALTH_MONITOR_URL=http://localhost:3010
```

## Data flow

1. User is on `/users`.
2. An API call fails with HTTP 503.
3. `useApi` interceptor sets `window.location.href` to `/maintenance?redirect=http%3A%2F%2Flocalhost%3A3001%2Fusers`.
4. Browser loads `/maintenance`.
5. Maintenance page decodes `redirect` and renders the "Go back" button.
6. User clicks "Go back" → browser navigates back to `/users`.
7. Or user clicks "Check system status" → new tab opens `http://localhost:3010/status`.

## Error handling / edge cases

| Case | Behavior |
|---|---|
| Already on `/maintenance` when another 5xx occurs | Stay on `/maintenance`; do not redirect again. |
| Missing or invalid `redirect` param | Default to `/dashboard`. |
| `redirect` points to `/maintenance` | Default to `/dashboard` to avoid a loop. |
| `HEALTH_MONITOR_URL` not configured | Hide the "Check system status" link. |
| 5xx during login | Redirect to `/maintenance` with `redirect=/login`; user can go back. |

## Testing

- **Manual:** Temporarily make an API route throw 500, visit an admin page, confirm redirect to `/maintenance` and that both buttons work.
- **No new unit tests:** The project has no component-test harness, and `window.location.href` assignments are difficult to unit-test in isolation.

## Files changed

- `layers/shared-api/composables/useApi.ts`
- `apps/admin/app/pages/maintenance.vue` (new)
- `apps/admin/nuxt.config.ts`
- `.env.example`
- `docs/30-Apps/Admin App/Overview.md`
- `docs/30-Apps/Health Monitor/Overview.md`

## Out of scope

- Auto-retry or polling on the maintenance page.
- Server-side rendering handling (admin app uses `ssr: false`).
- Inline error display for 5xx errors (we redirect instead).
- Changes to the health-monitor package itself.
