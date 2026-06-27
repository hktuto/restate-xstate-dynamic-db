# Admin Maintenance Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/maintenance` page to the admin app and redirect users there when any API call returns HTTP 5xx.

**Architecture:** Extend the existing `useApi` interceptor in the shared-api layer to detect 5xx responses and perform a full-page redirect to `/maintenance?redirect=<current-url>`. Add a new Nuxt page that uses the `auth` layout, validates the `redirect` query param, and offers "Go back" plus a link to the health monitor `/status` page.

**Tech Stack:** Vue 3, Nuxt 3, Nuxt UI, TypeScript

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/admin/nuxt.config.ts` | Adds `public.healthMonitorUrl` runtime config. |
| `.env.example` | Documents `HEALTH_MONITOR_URL`. |
| `layers/shared-api/composables/useApi.ts` | Detects 5xx and redirects to `/maintenance`. |
| `apps/admin/app/pages/maintenance.vue` | Renders the maintenance UI and handles redirect/status actions. |

---

### Task 1: Configure health monitor URL

**Files:**
- Modify: `apps/admin/nuxt.config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add runtime config**

In `apps/admin/nuxt.config.ts`, add `healthMonitorUrl` to `runtimeConfig.public`:

```ts
runtimeConfig: {
  public: {
    apiUrl: process.env.API_URL ?? 'http://localhost:3002',
    healthMonitorUrl: process.env.HEALTH_MONITOR_URL ?? 'http://localhost:3010',
  },
},
```

- [ ] **Step 2: Document env var**

In `.env.example`, under the health-monitor section, add:

```env
HEALTH_MONITOR_URL=http://localhost:3010
```

- [ ] **Step 3: Run admin typecheck**

Run: `pnpm --filter admin typecheck`
Expected: passes (or shows only pre-existing errors unrelated to this change).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/nuxt.config.ts .env.example
git commit -m "feat(admin): add healthMonitorUrl runtime config"
```

---

### Task 2: Update `useApi` to redirect on 5xx

**Files:**
- Modify: `layers/shared-api/composables/useApi.ts`

- [ ] **Step 1: Read current file**

Open `layers/shared-api/composables/useApi.ts` and confirm it currently handles only 401.

- [ ] **Step 2: Add 5xx redirect**

Add the 5xx branch after the existing 401 handling, leaving the 401 code unchanged:

```ts
onResponseError(context) {
  const { response } = context

  if (response?.status === 401 && import.meta.client) {
    const authenticated = useState<boolean>('adminAuthenticated', () => false)
    const user = useState<any>('adminUser', () => null)
    authenticated.value = false
    user.value = null
    navigateTo('/login')
    return
  }

  if (response?.status && response.status >= 500 && response.status <= 599) {
    if (!window.location.pathname.startsWith('/maintenance')) {
      window.location.href = '/maintenance?redirect=' + encodeURIComponent(window.location.href)
      return
    }
  }

  const body = response?._data as { error?: string } | undefined
  const message = body?.error ?? `API error ${response?.status ?? 'unknown'}`
  context.error = new Error(message)
}
```

Note: the admin app uses `ssr: false`, so `window.location.href` is safe for the 5xx redirect.

- [ ] **Step 3: Typecheck affected apps**

Run: `pnpm --filter admin typecheck`
Expected: passes (pre-existing errors excepted).

- [ ] **Step 4: Commit**

```bash
git add layers/shared-api/composables/useApi.ts
git commit -m "feat(shared-api): redirect to maintenance page on 5xx errors"
```

---

### Task 3: Create `/maintenance` page

**Files:**
- Create: `apps/admin/app/pages/maintenance.vue`

- [ ] **Step 1: Write the page**

```vue
<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const route = useRoute()
const config = useRuntimeConfig()

const redirect = computed<string>(() => {
  const raw = route.query.redirect
  if (typeof raw !== 'string') return '/dashboard'
  try {
    const url = new URL(raw)
    if (url.pathname === '/maintenance') return '/dashboard'
    return raw
  } catch {
    return '/dashboard'
  }
})

const healthMonitorStatusUrl = computed<string | null>(() => {
  const base = config.public.healthMonitorUrl as string | undefined
  if (!base) return null
  return base.replace(/\/$/, '') + '/status'
})

function goBack() {
  window.location.href = redirect.value
}
</script>

<template>
  <UCard class="w-full max-w-md">
    <div class="text-center space-y-4">
      <UIcon
        name="i-lucide-construction"
        class="w-12 h-12 mx-auto text-amber-500"
      />
      <h1 class="text-xl font-semibold">
        Service temporarily unavailable
      </h1>
      <p class="text-gray-500">
        The platform is experiencing issues. You can go back or check the system status.
      </p>
      <div class="flex flex-col gap-2">
        <UButton block @click="goBack">
          Go back
        </UButton>
        <UButton
          v-if="healthMonitorStatusUrl"
          block
          color="neutral"
          variant="outline"
          :to="healthMonitorStatusUrl"
          target="_blank"
        >
          Check system status
        </UButton>
      </div>
    </div>
  </UCard>
</template>
```

- [ ] **Step 2: Run admin typecheck**

Run: `pnpm --filter admin typecheck`
Expected: passes (pre-existing errors excepted).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/app/pages/maintenance.vue
git commit -m "feat(admin): add maintenance page with go-back and status links"
```

---

### Task 4: Manual verification

**Files:**
- None (manual verification)

- [ ] **Step 1: Start the API and admin dev servers**

Run:
```bash
docker compose up -d
pnpm --filter api dev
pnpm --filter admin dev
```

- [ ] **Step 2: Open the admin app and log in**

Navigate to `http://localhost:3001/login` and sign in.

- [ ] **Step 3: Trigger a 5xx error**

Temporarily edit an API route (for example, `apps/api/src/routes/users.ts`) to throw an error:

```ts
throw new Error('forced 500')
```

Then visit an admin page that calls that route (e.g. `/users`).

- [ ] **Step 4: Confirm redirect**

Expected: browser URL becomes `/maintenance?redirect=http%3A%2F%2Flocalhost%3A3001%2Fusers`.

- [ ] **Step 5: Confirm "Go back" button**

Click "Go back". Expected: browser navigates back to `/users`.

- [ ] **Step 6: Confirm "Check system status" link**

Trigger the redirect again, then click "Check system status". Expected: new tab opens `http://localhost:3010/status` showing the platform health table.

- [ ] **Step 7: Remove the temporary API error**

Revert the forced error so tests/demo data remains clean.

- [ ] **Step 8: Commit verification notes (optional)**

If any issues were found and fixed, commit those fixes. Otherwise no commit is needed for this task.

---

## Self-review

**Spec coverage:**
- 5xx redirect in `useApi`: covered in Task 2.
- `/maintenance` page with go-back and status link: covered in Task 3.
- Runtime config for health monitor URL: covered in Task 1.
- Manual verification: covered in Task 4.

**Placeholder scan:**
- No TBD/TODO.
- All code blocks contain concrete code.
- All commands include expected outputs.

**Type consistency:**
- `healthMonitorUrl` is added to runtime config and consumed as `config.public.healthMonitorUrl`.
- `redirect` query param is read as `route.query.redirect` and validated.
