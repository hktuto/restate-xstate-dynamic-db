# Admin login loading state and 500 maintenance redirect — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a loading state to the admin login submit button and redirect any admin-app HTTP 500 response to a new `/maintenance` page that preserves the original route in a `?redirect=` query parameter.

**Architecture:** A manual `pending` ref drives the login submit button's loading/disabled state. The shared `useApi()` interceptor catches all 500-family responses and redirects client-side to `/maintenance`. The auth middleware allows unauthenticated access to `/maintenance`. A new maintenance page reads `?redirect=` and offers a "Try again" button plus an external status-page link driven by runtime config.

**Tech Stack:** Nuxt 3/4, Vue 3, `@nuxt/ui` v4, TypeScript, `$fetch`, `useRuntimeConfig`, `useRoute`, `navigateTo`.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/admin/app/pages/login.vue` | Modify | Add manual `pending` ref bound to the submit button. |
| `apps/admin/app/middleware/auth.global.ts` | Modify | Allow unauthenticated access to `/maintenance`. |
| `apps/admin/nuxt.config.ts` | Modify | Expose `public.statusPageUrl` from `STATUS_PAGE_URL`. |
| `layers/shared-api/composables/useApi.ts` | Modify | Redirect client-side 500+ responses to `/maintenance?redirect=...`. |
| `apps/admin/app/pages/maintenance.vue` | Create | Display server-unavailable UI with try-again and status-page actions. |

---

### Task 1: Add loading state to login submit button

**Files:**
- Modify: `apps/admin/app/pages/login.vue`

- [ ] **Step 1: Add `pending` ref and update the login handler**

Add `pending` to the setup and wrap the request:

```ts
const pending = ref(false)

async function login() {
  error.value = ''
  pending.value = true
  try {
    const ok = await auth.login(state)
    if (!ok) {
      error.value = 'Login failed'
      return
    }
    await navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e.message || 'Login failed'
  } finally {
    pending.value = false
  }
}
```

- [ ] **Step 2: Update the submit button**

Change the submit button from:

```vue
<UButton type="submit" block>
  Sign in
</UButton>
```

To:

```vue
<UButton type="submit" block :loading="pending" :disabled="pending">
  {{ pending ? 'Signing in...' : 'Sign in' }}
</UButton>
```

A manual `pending` ref is used because `loading-auto` tracks the button's own `@click` promise, not the parent form's `@submit` promise.

- [ ] **Step 3: Verify the change**

Open `apps/admin/app/pages/login.vue` and confirm the button reads `<UButton type="submit" block :loading="pending" :disabled="pending">` and the `login()` function sets `pending.value = true` before the request.

---

### Task 2: Allow unauthenticated access to `/maintenance`

**Files:**
- Modify: `apps/admin/app/middleware/auth.global.ts`

- [ ] **Step 1: Add `/maintenance` to the public-path guard**

After the `/login` block, add a `/maintenance` early return:

```ts
if (to.path === '/login') {
  console.log('to.path', to.path, 'auth.authenticated.value', auth.authenticated.value)
  if(auth.authenticated.value) {
    return navigateTo('/')
  }
  return
}

if (to.path === '/maintenance') {
  return
}

if (!auth.authenticated.value) {
  return navigateTo('/login')
}
```

- [ ] **Step 2: Verify the middleware still typechecks**

Run:

```bash
pnpm --filter admin typecheck
```

Expected: the same pre-existing errors as before, with no new errors in `auth.global.ts`.

---

### Task 3: Expose status page URL in runtime config

**Files:**
- Modify: `apps/admin/nuxt.config.ts:11-15`

- [ ] **Step 1: Add `statusPageUrl` to public runtime config**

Change:

```ts
runtimeConfig: {
  public: {
    apiUrl: process.env.API_URL ?? 'http://localhost:3002',
  },
},
```

To:

```ts
runtimeConfig: {
  public: {
    apiUrl: process.env.API_URL ?? 'http://localhost:3002',
    statusPageUrl: process.env.STATUS_PAGE_URL,
  },
},
```

- [ ] **Step 2: Verify TypeScript accepts the new key**

Run:

```bash
pnpm --filter admin typecheck
```

Expected: command exits with code 0 (no type errors).

---

### Task 4: Redirect 500 responses to maintenance page

**Files:**
- Modify: `layers/shared-api/composables/useApi.ts:7-15`

- [ ] **Step 1: Update the response-error interceptor**

Change:

```ts
onResponseError(context) {
  const { response } = context
  if (response?.status === 401 && import.meta.client) {
    navigateTo('/login')
  }
  const body = response?._data as { error?: string } | undefined
  const message = body?.error ?? `API error ${response?.status ?? 'unknown'}`
  context.error = new Error(message)
},
```

To:

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
},
```

- [ ] **Step 2: Verify the interceptor still typechecks**

Run:

```bash
pnpm --filter admin typecheck
```

Expected: command exits with code 0.

---

### Task 5: Create the maintenance page

**Files:**
- Create: `apps/admin/app/pages/maintenance.vue`

- [ ] **Step 1: Write the page**

Create `apps/admin/app/pages/maintenance.vue` with:

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
      <h1 class="text-lg font-semibold">
        Server unavailable
      </h1>
    </template>

    <p class="text-sm text-neutral-500 mb-4">
      The server is temporarily unreachable. Please try again in a moment.
    </p>

    <div class="flex flex-col gap-2">
      <UButton block @click="tryAgain">
        Try again
      </UButton>

      <UButton
        block
        variant="ghost"
        :disabled="!statusUrl"
        @click="openStatus"
      >
        Check system status
      </UButton>
    </div>
  </UCard>
</template>
```

- [ ] **Step 2: Verify the new page typechecks**

Run:

```bash
pnpm --filter admin typecheck
```

Expected: command exits with code 0.

---

### Task 6: Manual verification

- [ ] **Step 1: Start the API and admin dev servers**

```bash
docker compose up -d
pnpm --filter api dev
# in another terminal
pnpm --filter admin dev
```

- [ ] **Step 2: Verify `/maintenance` is reachable without authentication**

1. In an incognito window or after clearing cookies, open `/maintenance?redirect=%2Fdashboard`.
2. Confirm the page renders instead of redirecting to `/login`.

- [ ] **Step 3: Verify login loading state**

1. Open the login page on the dev-server port (e.g., http://localhost:3001 or the port printed at startup).
2. Enter credentials and click **Sign in**.
3. Confirm the button shows a spinner and is disabled while the request is pending.

- [ ] **Step 4: Verify 500 → maintenance redirect**

1. Stop the API server (or trigger a 500 response) while staying on the admin app.
2. Submit the login form or navigate to a page that triggers an API call.
3. Confirm the browser redirects to `/maintenance?redirect=%2F...`.

- [ ] **Step 5: Verify maintenance page actions**

1. On `/maintenance?redirect=%2Fdashboard`, click **Try again**.
2. Confirm navigation back to `/dashboard`.
3. Set `STATUS_PAGE_URL=https://example.com/status` and restart the admin dev server.
4. Click **Check system status** and confirm it opens the URL in a new tab.
5. Unset `STATUS_PAGE_URL`, restart, and confirm **Check system status** is disabled.

---

## Self-review checklist

- [ ] Spec coverage: loading state, auth-middleware `/maintenance` bypass, 500 redirect with `?redirect=`, maintenance page, status-page config are all implemented.
- [ ] Placeholder scan: no TBD, TODO, or vague steps.
- [ ] Type consistency: `statusPageUrl` is read from `config.public.statusPageUrl` in the page and written from `process.env.STATUS_PAGE_URL` in `nuxt.config.ts`.
