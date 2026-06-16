---
title: Standalone Health Monitor Service Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-16
updated: 2026-06-16
---

# Standalone Health Monitor Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the health check runner from the admin app into a dedicated `apps/health-monitor` service that runs on Bun and writes results to SurrealDB.

**Architecture:** Move the existing runner logic into a new workspace package, add a small standalone scheduler loop with graceful shutdown, delete the admin in-process scheduler, and remove the manual trigger from the admin UI/API. Admin and web apps continue to read health data from the DB.

**Tech Stack:** TypeScript, Bun, SurrealDB via `db` package, pnpm workspace.

---

### Task 1: Install Bun

**Files:**
- None (system-level tool)

- [ ] **Step 1: Install Bun**

```bash
curl -fsSL https://bun.sh/install | bash
```

- [ ] **Step 2: Verify installation**

```bash
bun --version
```

Expected: a version number is printed (e.g., `1.x.x`).

---

### Task 2: Create the `apps/health-monitor` package

**Files:**
- Create: `apps/health-monitor/package.json`
- Create: `apps/health-monitor/tsconfig.json`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "health-monitor",
  "type": "module",
  "scripts": {
    "dev": "bun src/index.ts",
    "start": "bun src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "db": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "bun-types": "latest"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Install dependencies**

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` is updated and `apps/health-monitor/node_modules` is created.

- [ ] **Step 4: Commit**

```bash
git add apps/health-monitor/package.json apps/health-monitor/tsconfig.json pnpm-lock.yaml
git commit -m "chore(health-monitor): create service package with Bun runtime"
```

---

### Task 3: Move the runner to the service

**Files:**
- Create: `apps/health-monitor/src/runner.ts`
- Delete: `apps/admin/server/utils/health-monitor.ts`

- [ ] **Step 1: Move and adapt the runner**

Create `apps/health-monitor/src/runner.ts` with the contents of the existing `apps/admin/server/utils/health-monitor.ts`. The imports already use `db/client` and `db/health-checks`, so no changes are needed inside the file.

```ts
import { getSurreal, closeSurreal } from 'db/client'
import type { HealthCheckInput, HealthCheckService } from 'db/health-checks'

const CHECK_TIMEOUT_MS = 5000
type CheckResult = Omit<HealthCheckInput, 'checkedAt'>

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer))
  })
}

async function checkSurrealDB(): Promise<CheckResult> {
  const service: HealthCheckService = 'surrealdb'
  const url = process.env.SURREAL_URL
  const user = process.env.SURREAL_USER
  const pass = process.env.SURREAL_PASS
  if (!url || !user || !pass) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing SurrealDB env vars' }
  }
  const start = Date.now()
  try {
    await withTimeout((async () => {
      const surreal = await getSurreal('platform', 'admin')
      try {
        await surreal.query('RETURN 1')
      } finally {
        try { await closeSurreal(surreal) } catch {}
      }
    })(), CHECK_TIMEOUT_MS)
    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
}

async function checkHttpService(
  service: HealthCheckService,
  envVarName: string,
  path: string
): Promise<CheckResult> {
  const url = process.env[envVarName]
  if (!url) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: `Missing ${envVarName}` }
  }
  const start = Date.now()
  try {
    const res = await withTimeout(fetch(`${url}${path}`), CHECK_TIMEOUT_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
}

async function checkRestate(): Promise<CheckResult> {
  const service: HealthCheckService = 'restate'
  const url = process.env.RESTATE_META_URL
  if (!url) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing RESTATE_META_URL' }
  }

  const start = Date.now()
  try {
    const res = await withTimeout(fetch(`${url}/services`), CHECK_TIMEOUT_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const body = await res.json() as { services?: Array<{ name?: string }> }
    const services = Array.isArray(body.services) ? body.services : []
    const hasWorkflow = services.some((s) => s.name === 'workflow')

    if (!hasWorkflow) {
      return {
        service,
        status: 'unhealthy',
        responseTimeMs: Date.now() - start,
        message: 'Restate is reachable but the workflow service is not registered'
      }
    }

    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return {
      service,
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      message: err instanceof Error ? err.message : String(err)
    }
  }
}

function checkWorkflowRuntime(): Promise<CheckResult> {
  return checkHttpService('workflow-runtime', 'WORKFLOW_RUNTIME_URL', '/health')
}

function checkWebApi(): Promise<CheckResult> {
  return checkHttpService('web-api', 'WEB_API_URL', '/api/health')
}

export async function runHealthChecks(): Promise<CheckResult[]> {
  return Promise.all([
    checkSurrealDB(),
    checkRestate(),
    checkWorkflowRuntime(),
    checkWebApi()
  ])
}
```

- [ ] **Step 2: Delete the admin runner**

```bash
rm apps/admin/server/utils/health-monitor.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/health-monitor/src/runner.ts
git rm apps/admin/server/utils/health-monitor.ts
git commit -m "refactor(health-monitor): move runner from admin to standalone service"
```

---

### Task 4: Create the service entry point

**Files:**
- Create: `apps/health-monitor/src/index.ts`

- [ ] **Step 1: Write the scheduler loop**

```ts
import { runHealthChecks } from './runner.js'
import { createHealthCheck, pruneHealthChecks } from 'db/health-checks'

const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_HISTORY_LIMIT = 100

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseIntervalMs(value: string | undefined): number | null {
  if (value === '0') return null
  if (value === undefined || value === '') return DEFAULT_INTERVAL_MS
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS
}

const INTERVAL_MS = parseIntervalMs(process.env.HEALTH_CHECK_INTERVAL_MS)
const HISTORY_LIMIT = parsePositiveInt(process.env.HEALTH_CHECK_HISTORY_LIMIT, DEFAULT_HISTORY_LIMIT)

if (INTERVAL_MS === null) {
  console.log('Health monitor disabled (HEALTH_CHECK_INTERVAL_MS=0)')
  process.exit(0)
}

console.log(`Health monitor started: intervalMs=${INTERVAL_MS}, historyLimit=${HISTORY_LIMIT}`)

let isRunning = false
let isShuttingDown = false

async function tick() {
  if (isRunning) {
    console.warn('Health monitor tick skipped: previous tick still running')
    return
  }
  if (isShuttingDown) return

  isRunning = true
  try {
    const results = await runHealthChecks()
    for (const result of results) {
      try {
        await createHealthCheck({
          service: result.service,
          status: result.status,
          checkedAt: new Date().toISOString(),
          responseTimeMs: result.responseTimeMs,
          message: result.message,
          details: result.details
        })
        await pruneHealthChecks(result.service, HISTORY_LIMIT)
      } catch (err) {
        console.error(`Health monitor persistence failed for ${result.service}:`, err)
      }
    }
    console.log(`Health monitor tick completed: ${results.length} services checked`)
  } catch (err) {
    console.error('Health monitor tick failed:', err)
  } finally {
    isRunning = false
  }
}

function shutdown(signal: string) {
  console.log(`Health monitor received ${signal}, shutting down...`)
  isShuttingDown = true
  if (interval) {
    clearInterval(interval)
  }
  // Allow an in-flight tick to finish, then exit.
  const check = () => {
    if (isRunning) {
      setTimeout(check, 100)
      return
    }
    process.exit(0)
  }
  check()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

await tick()
const interval = setInterval(tick, INTERVAL_MS)
```

- [ ] **Step 2: Commit**

```bash
git add apps/health-monitor/src/index.ts
git commit -m "feat(health-monitor): add Bun scheduler loop with graceful shutdown"
```

---

### Task 5: Delete admin scheduler and config

**Files:**
- Delete: `apps/admin/server/plugins/health-monitor-scheduler.ts`
- Delete: `apps/admin/server/utils/health-check-config.ts`

- [ ] **Step 1: Delete files**

```bash
rm apps/admin/server/plugins/health-monitor-scheduler.ts
rm apps/admin/server/utils/health-check-config.ts
```

- [ ] **Step 2: Verify no remaining imports**

```bash
rg "health-monitor-scheduler|health-check-config|#server/utils/health-monitor" apps/admin
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git rm apps/admin/server/plugins/health-monitor-scheduler.ts
git rm apps/admin/server/utils/health-check-config.ts
git commit -m "refactor(admin): remove in-process health monitor scheduler"
```

---

### Task 6: Remove manual trigger from admin UI/API

**Files:**
- Delete: `apps/admin/server/api/health-checks/run.post.ts`
- Modify: `apps/admin/app/pages/health.vue`

- [ ] **Step 1: Delete the run endpoint**

```bash
rm apps/admin/server/api/health-checks/run.post.ts
```

- [ ] **Step 2: Update `apps/admin/app/pages/health.vue`**

Remove the `running`, `runError`, and `runNow` code, and replace the "Run checks now" button with a "Refresh" button that only re-fetches the latest data.

```vue
<script setup lang="ts">
import type { HealthCheckRecord, HealthCheckService } from 'db/health-checks'

interface LatestData {
  latest: HealthCheckRecord[]
}

interface HistoryData {
  service: HealthCheckService
  limit: number
  history: HealthCheckRecord[]
}

const DEFAULT_HISTORY_LIMIT = 20

const { data, refresh, pending, error } = await useFetch<LatestData>('/api/health-checks')
const expanded = ref<Set<HealthCheckService>>(new Set())

const historyByService = ref<Partial<Record<HealthCheckService, HealthCheckRecord[]>>>({})
const historyPending = ref<Set<HealthCheckService>>(new Set())
const historyError = ref<Partial<Record<HealthCheckService, string>>>({})

const firstService = computed<HealthCheckService | null>(() => data.value?.latest[0]?.service ?? null)

watch(
  firstService,
  (service) => {
    if (service && !expanded.value.has(service)) {
      expanded.value = new Set(expanded.value).add(service)
    }
  },
  { immediate: true }
)

async function loadHistory(service: HealthCheckService, force = false) {
  if (!force && historyByService.value[service] !== undefined) return

  historyPending.value.add(service)
  historyError.value[service] = undefined

  try {
    const result = await $fetch<HistoryData>('/api/health-checks/history', {
      query: { service, limit: DEFAULT_HISTORY_LIMIT }
    })
    historyByService.value[service] = result.history
  } catch (err) {
    historyError.value[service] = err instanceof Error ? err.message : String(err)
  } finally {
    historyPending.value.delete(service)
  }
}

watch(
  expanded,
  (services) => {
    for (const service of services) {
      loadHistory(service)
    }
  },
  { immediate: true }
)

function toggle(service: HealthCheckService) {
  const next = new Set(expanded.value)
  if (next.has(service)) {
    next.delete(service)
  } else {
    next.add(service)
  }
  expanded.value = next
}

function statusClass(status: string): string {
  return status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Health Monitor</h1>
      <button
        :disabled="pending"
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        @click="refresh"
      >
        {{ pending ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>

    <div v-if="pending" class="text-gray-500">Loading health checks...</div>
    <div v-else-if="error" class="text-red-600">Failed to load health checks: {{ error.message }}</div>
    <template v-else>
      <div v-if="!data?.latest?.length" class="text-gray-500">
        No health checks available yet. The health monitor service will populate them shortly.
      </div>
      <div v-else class="space-y-4">
        <div
          v-for="check in data.latest"
          :key="check.service"
          class="bg-white rounded shadow overflow-hidden"
        >
          <button
            class="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            @click="toggle(check.service)"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-500 capitalize">{{ check.service }}</span>
              <svg
                class="w-4 h-4 text-gray-400 transition-transform"
                :class="{ 'rotate-180': expanded.has(check.service) }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span
                class="inline-block w-3 h-3 rounded-full"
                :class="statusClass(check.status)"
                :aria-label="check.status"
              />
              <span class="text-lg font-semibold capitalize">{{ check.status }}</span>
            </div>
            <div class="text-xs text-gray-400 mt-2">Last check: {{ formatDate(check.checkedAt) }}</div>
            <div class="text-xs text-gray-500 mt-1">{{ check.responseTimeMs }}ms</div>
          </button>

          <div
            v-if="expanded.has(check.service)"
            class="border-t px-4 pb-4"
          >
            <div class="pt-3">
              <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Recent history
              </h3>
              <div v-if="historyPending.has(check.service)" class="text-sm text-gray-500">
                Loading history...
              </div>
              <div v-else-if="historyError[check.service]" class="text-sm text-red-600">
                {{ historyError[check.service] }}
              </div>
              <div v-else-if="!historyByService[check.service]?.length" class="text-sm text-gray-500">
                No history available.
              </div>
              <ul v-else class="space-y-2">
                <li
                  v-for="row in historyByService[check.service]"
                  :key="row.id"
                  class="text-sm border-b last:border-b-0 pb-2 last:pb-0"
                >
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-block w-2 h-2 rounded-full"
                      :class="statusClass(row.status)"
                      :aria-label="row.status"
                    />
                    <span class="capitalize">{{ row.status }}</span>
                    <span class="text-gray-400 ml-auto">{{ row.responseTimeMs }}ms</span>
                  </div>
                  <div class="text-gray-500 text-xs mt-1">{{ formatDate(row.checkedAt) }}</div>
                  <div v-if="row.message" class="text-red-600 text-xs mt-1">{{ row.message }}</div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 3: Verify no remaining references to `/api/health-checks/run`**

```bash
rg "/api/health-checks/run" apps/admin
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git rm apps/admin/server/api/health-checks/run.post.ts
git add apps/admin/app/pages/health.vue
git commit -m "refactor(admin): remove manual health check trigger"
```

---

### Task 7: Update documentation

**Files:**
- Modify: `docs/50-Features/Admin Health Monitor.md`
- Modify: `docs/30-Apps/Admin App/Overview.md`
- Modify: `docs/60-Development/Getting Started.md`

- [ ] **Step 1: Update `docs/50-Features/Admin Health Monitor.md`**

In the `## Overview` paragraph, replace:

```markdown
A background scheduler runs periodic checks and stores the results in SurrealDB.
```

with:

```markdown
A standalone `health-monitor` service runs periodic checks and stores the results in SurrealDB.
```

In the `## Admin page` section, replace:

```markdown
- A manual "Run checks now" button re-runs all checks and refreshes the histories of all expanded services.
```

with:

```markdown
- A "Refresh" button re-fetches the latest results from SurrealDB.
```

- [ ] **Step 2: Update `docs/30-Apps/Admin App/Overview.md`**

If the key behaviors mention the scheduler, replace with a note that the admin app reads health data written by the standalone `health-monitor` service.

- [ ] **Step 3: Update `docs/60-Development/Getting Started.md`**

Add `pnpm --filter health-monitor dev` to the startup commands list.

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs: health monitor is now a standalone service"
```

---

### Task 8: Verify the build

- [ ] **Step 1: Install dependencies for the new package**

```bash
pnpm install
```

- [ ] **Step 2: Type-check the service**

```bash
pnpm --filter health-monitor typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 3: Build the remaining apps**

```bash
pnpm -r build
```

Expected: all packages and apps build successfully.

- [ ] **Step 4: Smoke-test the service (optional, requires running infrastructure)**

```bash
pnpm --filter health-monitor dev
```

Expected: logs show "Health monitor started" and the first tick completes for all four services.

---

## Self-review checklist

- [x] Spec coverage: new service, runner moved, admin scheduler removed, manual trigger removed, docs updated, build verification.
- [x] No placeholders: every step contains exact file paths and code.
- [x] Type consistency: service names, env var names, and function signatures match the existing `db/health-checks` types.
