---
title: "Admin login loading state and 500 maintenance redirect"
type: note
status: in-progress
area: admin
app:
  - admin
created: 2026-06-26
updated: 2026-06-26
related:
  - [[30-Apps/Admin App/Overview]]
  - [[Admin Authentication & Authorization]]
  - [[API]]
---

# Admin login loading state and 500 maintenance redirect

Add a loading state to the admin login submit button and redirect all admin-app HTTP 500 responses to a new `/maintenance` page that can send the user back to the page they came from.

## Context

- The admin app is a client-side Nuxt SPA using `@nuxt/ui` v4.
- Login is handled in `apps/admin/app/pages/login.vue` and calls `useAuth().login()`.
- API requests go through `layers/shared-api/composables/useApi.ts`, which wraps `$fetch` and already redirects 401 responses to `/login`.
- The API login endpoint can return 500 when the database is unreachable.
- `apps/web` already has a maintenance-page pattern, but `apps/admin` does not.

## Goals

1. Show a loading state on the login submit button while the login request is in flight.
2. Redirect any admin-app API response with status `>= 500` to a `/maintenance` page.
3. Preserve the original page path in a `?redirect=` query parameter so the maintenance page can send the user back.
4. Provide a link to an external status page from the maintenance page.

## Design

### 1. Login button loading state

In `apps/admin/app/pages/login.vue`, track a `pending` ref and bind it to the submit button's `loading` and `disabled` props:

```vue
<script setup lang="ts">
const pending = ref(false)

async function login() {
  error.value = ''
  pending.value = true
  try {
    // ... existing login logic
  } catch (e: any) {
    error.value = e.message || 'Login failed'
  } finally {
    pending.value = false
  }
}
</script>

<UButton type="submit" block :loading="pending" :disabled="pending">
  {{ pending ? 'Signing in...' : 'Sign in' }}
</UButton>
```

A manual `pending` ref is used instead of Nuxt UI's `loading-auto` because `loading-auto` tracks the button's own `@click` promise, not the parent form's `@submit` promise.

### 2. Allow unauthenticated access to the maintenance page

The global auth middleware (`apps/admin/app/middleware/auth.global.ts`) redirects any unauthenticated user away from every page except `/login`. Add `/maintenance` to the allow-list so a user can reach it after being redirected from a 500 response:

```ts
if (to.path === '/login') {
  // ... existing login handling
  return
}

if (to.path === '/maintenance') {
  return
}

if (!auth.authenticated.value) {
  return navigateTo('/login')
}
```

### 3. Global 500 → maintenance redirect

In `layers/shared-api/composables/useApi.ts`, extend `onResponseError` to redirect client-side 500-family responses to `/maintenance` with the current route as a query parameter:

```ts
onResponseError(context) {
  const { response } = context

  if (response?.status && response.status >= 500 && import.meta.client) {
    const route = useRoute()
    navigateTo(`/maintenance?redirect=${encodeURIComponent(route.fullPath)}`)
    return
  }

  if (response?.status === 401 && import.meta.client) {
    navigateTo('/login')
  }

  const body = response?._data as { error?: string } | undefined
  const message = body?.error ?? `API error ${response?.status ?? 'unknown'}`
  context.error = new Error(message)
}
```

This covers every request made through `useApi()` in the admin app, not just login.

### 3. Maintenance page

Create `apps/admin/app/pages/maintenance.vue` using the auth layout. It displays a server-unavailable message and two actions:

- **Try again** — navigates back to the path in `?redirect=` if it is a local path, otherwise `/login`.
- **Check system status** — opens the URL from `config.public.statusPageUrl` in a new tab.

```vue
<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const route = useRoute()
const config = useRuntimeConfig()

const redirect = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') ? r : '/login'
})

const statusUrl = computed(() => config.public.statusPageUrl as string | undefined)

function tryAgain() {
  navigateTo(redirect.value)
}

function openStatus() {
  if (statusUrl.value) {
    window.open(statusUrl.value, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <UCard class="w-full max-w-sm">
    <template #header>
      <h1 class="text-lg font-semibold">Server unavailable</h1>
    </template>
    <p class="text-sm text-neutral-500 mb-4">
      The server is temporarily unreachable. Please try again in a moment.
    </p>
    <div class="flex flex-col gap-2">
      <UButton block @click="tryAgain">Try again</UButton>
      <UButton block variant="ghost" :disabled="!statusUrl" @click="openStatus">
        Check system status
      </UButton>
    </div>
  </UCard>
</template>
```

### 4. Runtime config

In `apps/admin/nuxt.config.ts`, expose `public.statusPageUrl` so it can be set via `STATUS_PAGE_URL`:

```ts
runtimeConfig: {
  public: {
    apiUrl: process.env.API_URL ?? 'http://localhost:3002',
    statusPageUrl: process.env.STATUS_PAGE_URL,
  },
}
```

If `statusPageUrl` is not configured, the **Check system status** button is disabled.

## Files changed

- `apps/admin/app/pages/login.vue`
- `apps/admin/app/middleware/auth.global.ts`
- `layers/shared-api/composables/useApi.ts`
- `apps/admin/app/pages/maintenance.vue` (new)
- `apps/admin/nuxt.config.ts`

## Out of scope

- Changing API error responses or introducing a 503 status. All 500-family responses are treated as maintenance events.
- Adding a global error boundary or Vue error handler.
- Reusing `apps/web` maintenance-page components; the admin app keeps its own page.
