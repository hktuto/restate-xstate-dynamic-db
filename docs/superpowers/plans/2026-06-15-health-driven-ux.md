---
title: Health-Driven UX Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-16
updated: 2026-06-16
related:
  - [[50-Features/Admin Health Monitor]]
---

# Health-Driven UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web app react to platform health checks by showing a maintenance page for critical failures and a degradation banner for workflow-service outages.

**Architecture:** The web app reads the latest health checks that the admin scheduler already writes to SurrealDB. A shared server util computes `normal`/`degraded`/`maintenance`. Server middleware sets this on each request, an API endpoint exposes it, a client plugin hydrates global state, and the layout/middleware drive the UI.

**Tech Stack:** Nuxt 4, Nitro, Vue 3, Tailwind CSS, SurrealDB via `db` package.

---

### Task 1: Add staleness env var to `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add `PLATFORM_STATUS_STALENESS_MS`**

Append under the existing health monitor block:

```bash
# Platform status (web app)
PLATFORM_STATUS_STALENESS_MS=300000
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add PLATFORM_STATUS_STALENESS_MS to env example"
```

---

### Task 2: Create shared platform-status utility

**Files:**
- Create: `apps/web/server/utils/platform-status.ts`

- [ ] **Step 1: Write `getPlatformStatus()`**

```ts
import { listLatestHealthChecks, type HealthCheckRecord } from 'db/health-checks'

export type PlatformMode = 'normal' | 'degraded' | 'maintenance'

export interface PlatformStatus {
  mode: PlatformMode
  message?: string
  checks: HealthCheckRecord[]
  checkedAt?: string
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const STALENESS_MS = parsePositiveInt(process.env.PLATFORM_STATUS_STALENESS_MS, 5 * 60 * 1000)

function getNewestCheckedAt(checks: HealthCheckRecord[]): string | undefined {
  if (checks.length === 0) return undefined
  return checks.reduce(
    (latest, check) => (check.checkedAt > latest ? check.checkedAt : latest),
    checks[0].checkedAt
  )
}

function isStale(checks: HealthCheckRecord[]): boolean {
  const newest = getNewestCheckedAt(checks)
  if (!newest) return true
  return Date.now() - new Date(newest).getTime() > STALENESS_MS
}

function isUnhealthy(checks: HealthCheckRecord[], service: string): boolean {
  return checks.some((check) => check.service === service && check.status === 'unhealthy')
}

export async function getPlatformStatus(): Promise<PlatformStatus> {
  let checks: HealthCheckRecord[]
  try {
    checks = await listLatestHealthChecks()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { mode: 'maintenance', message: `Failed to read health checks: ${message}`, checks: [] }
  }

  const checkedAt = getNewestCheckedAt(checks)

  if (checks.length === 0 || isStale(checks)) {
    return {
      mode: 'maintenance',
      message: 'Health checks are stale or unavailable',
      checks,
      checkedAt
    }
  }

  if (isUnhealthy(checks, 'surrealdb') || isUnhealthy(checks, 'web-api')) {
    return {
      mode: 'maintenance',
      message: 'Platform maintenance in progress',
      checks,
      checkedAt
    }
  }

  if (isUnhealthy(checks, 'restate') || isUnhealthy(checks, 'workflow-runtime')) {
    return {
      mode: 'degraded',
      message: 'Some features are temporarily unavailable',
      checks,
      checkedAt
    }
  }

  return { mode: 'normal', checks, checkedAt }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/utils/platform-status.ts
git commit -m "feat(web): add platform status utility"
```

---

### Task 3: Expose `/api/platform-status`

**Files:**
- Create: `apps/web/server/api/platform-status.get.ts`

- [ ] **Step 1: Write the endpoint**

```ts
import { getPlatformStatus } from '#server/utils/platform-status'

export default defineEventHandler(async () => {
  return await getPlatformStatus()
})
```

- [ ] **Step 2: Verify it builds**

```bash
pnpm --filter web build
```

Expected: build completes without TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/api/platform-status.get.ts
git commit -m "feat(web): add /api/platform-status endpoint"
```

---

### Task 4: Create `usePlatformStatus` composable

**Files:**
- Create: `apps/web/app/composables/usePlatformStatus.ts`

- [ ] **Step 1: Write the composable**

```ts
import type { PlatformStatus } from '#server/utils/platform-status'

export function usePlatformStatus(): PlatformStatus | null {
  const event = useRequestEvent()
  if (event) {
    return event.context.platformStatus ?? null
  }
  return useState<PlatformStatus | null>('platformStatus', () => null).value
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/composables/usePlatformStatus.ts
git commit -m "feat(web): add usePlatformStatus composable"
```

---

### Task 5: Hydrate status on the client

**Files:**
- Create: `apps/web/app/plugins/platform-status.client.ts`

- [ ] **Step 1: Write the client plugin**

```ts
import type { PlatformStatus } from '#server/utils/platform-status'

export default defineNuxtPlugin(async () => {
  const status = useState<PlatformStatus | null>('platformStatus', () => null)
  try {
    status.value = await $fetch<PlatformStatus>('/api/platform-status')
  } catch {
    // Fail silently; the app continues without a status.
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/plugins/platform-status.client.ts
git commit -m "feat(web): hydrate platform status on client boot"
```

---

### Task 6: Compute status on every server request

**Files:**
- Create: `apps/web/server/middleware/platform-status.ts`

- [ ] **Step 1: Write the server middleware**

```ts
import { getPlatformStatus, type PlatformStatus } from '#server/utils/platform-status'

declare module 'h3' {
  interface H3EventContext {
    platformStatus?: PlatformStatus
  }
}

export default defineEventHandler(async (event) => {
  const path = getRequestPath(event)

  // Don't block API routes or Nuxt internals.
  if (
    path.startsWith('/api/') ||
    path.startsWith('/_nuxt/') ||
    path.startsWith('/__nuxt/') ||
    path.startsWith('/favicon')
  ) {
    return
  }

  const status = await getPlatformStatus()
  event.context.platformStatus = status

  if (status.mode === 'maintenance' && path !== '/maintenance') {
    return sendRedirect(event, '/maintenance')
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/server/middleware/platform-status.ts
git commit -m "feat(web): compute platform status on each request"
```

---

### Task 7: Redirect to maintenance on client navigation

**Files:**
- Create: `apps/web/app/middleware/platform-status.global.ts`

- [ ] **Step 1: Write the client route middleware**

```ts
import type { PlatformStatus } from '#server/utils/platform-status'

export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/api/') || to.path === '/maintenance') {
    return
  }

  let status: PlatformStatus | null = null
  if (process.server) {
    const event = useRequestEvent()
    status = event?.context.platformStatus ?? null
  } else {
    status = useState<PlatformStatus | null>('platformStatus').value
  }

  if (status?.mode === 'maintenance') {
    return navigateTo('/maintenance')
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/middleware/platform-status.global.ts
git commit -m "feat(web): redirect to maintenance page during client navigation"
```

---

### Task 8: Create the maintenance page

**Files:**
- Create: `apps/web/app/pages/maintenance.vue`

- [ ] **Step 1: Write the page**

```vue
<script setup lang="ts">
if (process.server) {
  const event = useRequestEvent()
  if (event) {
    setResponseStatus(event, 503)
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gray-50">
    <div class="max-w-md text-center">
      <h1 class="text-2xl font-semibold text-gray-900">Platform maintenance</h1>
      <p class="mt-2 text-gray-600">We're working on it. Please try again later.</p>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/pages/maintenance.vue
git commit -m "feat(web): add maintenance page"
```

---

### Task 9: Add degradation banner to the default layout

**Files:**
- Modify: `apps/web/app/layouts/default.vue`

- [ ] **Step 1: Update the layout**

```vue
<script setup lang="ts">
const status = usePlatformStatus()
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <div
      v-if="status?.mode === 'degraded'"
      class="bg-yellow-50 border-b border-yellow-200 text-yellow-800 px-4 py-2"
    >
      <div class="max-w-5xl mx-auto text-sm font-medium">
        {{ status.message ?? 'Some features are temporarily unavailable.' }}
      </div>
    </div>
    <nav class="bg-white border-b border-gray-200">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex gap-6">
          <NuxtLink to="/" class="font-semibold hover:text-blue-600">Home</NuxtLink>
          <NuxtLink to="/users" class="hover:text-blue-600">Users</NuxtLink>
          <NuxtLink to="/workflows" class="hover:text-blue-600">Workflows</NuxtLink>
          <NuxtLink to="/triggers" class="hover:text-blue-600">Triggers</NuxtLink>
          <NuxtLink to="/user-tasks" class="hover:text-blue-600">Tasks</NuxtLink>
        </div>
        <CompanySwitcher />
      </div>
    </nav>
    <main class="max-w-5xl mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/layouts/default.vue
git commit -m "feat(web): show degradation banner in default layout"
```

---

### Task 10: Update web app documentation

**Files:**
- Modify: `docs/30-Apps/Web App/Overview.md`

- [ ] **Step 1: Add platform-status section**

Insert after the `## Middleware` section:

```markdown
## Platform status

The web app reads the latest health checks written by the admin health monitor and reacts to them:

- `normal` — no UI impact.
- `degraded` — a global banner warns that some features (e.g., workflows) are temporarily unavailable.
- `maintenance` — non-API routes redirect to `/maintenance` and return HTTP 503.

See [[50-Features/Admin Health Monitor]] for how checks are produced.
```

- [ ] **Step 2: Update routes table**

Add this row to the routes table:

```markdown
| `/maintenance` | Maintenance page shown when critical services are unhealthy. |
```

- [ ] **Step 3: Update `updated:` frontmatter date**

Set `updated: 2026-06-15`.

- [ ] **Step 4: Commit**

```bash
git add docs/30-Apps/Web App/Overview.md
git commit -m "docs: document web app platform status behavior"
```

---

### Task 11: Update admin health monitor feature docs

**Files:**
- Modify: `docs/50-Features/Admin Health Monitor.md`

- [ ] **Step 1: Mention web app UX**

Append to the `## Overview` paragraph:

```markdown
The same health data also drives the web app's platform status, which can show a maintenance page or a degradation banner.
```

- [ ] **Step 2: Commit**

```bash
git add docs/50-Features/Admin Health Monitor.md
git commit -m "docs: note that health checks drive web app UX"
```

---

### Task 12: Build and manual verification

- [ ] **Step 1: Full workspace build**

```bash
pnpm -r build
```

Expected: all packages and apps build successfully.

- [ ] **Step 2: Start local services**

```bash
docker compose up -d
pnpm --filter db seed
pnpm --filter admin dev
pnpm --filter web dev
```

- [ ] **Step 3: Populate health checks**

Open http://localhost:3001/health and click **Run checks now**. Wait for the scheduler tick if needed.

- [ ] **Step 4: Verify normal mode**

Open http://localhost:3000/. Expected: no banner, no redirect.

- [ ] **Step 5: Verify degraded mode**

Stop the workflow-runtime container:

```bash
docker compose stop workflow-runtime
```

Wait for the admin scheduler to run (or click **Run checks now** in the admin health page). Then refresh http://localhost:3000/. Expected: a yellow banner appears at the top saying workflow features are unavailable, but pages remain usable.

Restart the container when done:

```bash
docker compose start workflow-runtime
```

- [ ] **Step 6: Verify maintenance mode**

Stop SurrealDB:

```bash
docker compose stop surrealdb
```

Wait for a scheduler tick or run checks manually, then open http://localhost:3000/. Expected: redirect to `/maintenance` with HTTP 503 on SSR.

Restart SurrealDB when done:

```bash
docker compose start surrealdb
```

- [ ] **Step 7: Commit verification notes (optional)**

If any verification step fails, fix the code and re-run before finishing.

---

## Self-review checklist

- [x] Spec coverage: `/api/platform-status`, server middleware, client plugin, composable, layout banner, maintenance page, redirects, docs, env var.
- [x] No placeholders: every step contains exact file paths and code.
- [x] Type consistency: `PlatformStatus`, `PlatformMode`, and service names match the spec and `db/health-checks` types.
