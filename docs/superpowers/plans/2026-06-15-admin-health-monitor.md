> **I'm using the writing-plans skill to create the implementation plan.**

# Admin Health Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a service health monitor in the admin app that periodically checks SurrealDB, Restate, workflow-runtime, and the web API, stores results in SurrealDB, and displays them on a new admin page.

**Architecture:** A Nitro plugin in the admin app runs checks on a configurable interval. Check results are written to `platform/admin.health_checks`. The admin UI reads the latest and historical results via a dedicated API. The check runner is isolated from the scheduler so it can move to a standalone service later.

**Tech Stack:** Nuxt/Nitro, SurrealDB, TypeScript, Restate SDK.

---

### Task 1: DB package — add health check CRUD

**Files:**
- Create: `packages/db/src/health-checks.ts`
- Modify: `packages/db/package.json`
- Test: `pnpm --filter db build`

- [ ] **Step 1: Create `packages/db/src/health-checks.ts`**

```ts
import { getSurreal, closeSurreal } from './client.js'

export type HealthCheckService = 'surrealdb' | 'restate' | 'workflow-runtime' | 'web-api'
export type HealthCheckStatus = 'healthy' | 'unhealthy'

export interface HealthCheckRecord {
  id: string
  service: HealthCheckService
  status: HealthCheckStatus
  checkedAt: string
  responseTimeMs: number
  message?: string
  details?: Record<string, unknown>
}

export interface HealthCheckInput {
  service: HealthCheckService
  status: HealthCheckStatus
  checkedAt: string
  responseTimeMs: number
  message?: string
  details?: Record<string, unknown>
}

export async function createHealthCheck(input: HealthCheckInput): Promise<HealthCheckRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [created] = await surreal.query<[HealthCheckRecord[]]>(
      'CREATE health_checks CONTENT $data',
      { data: input }
    )
    return created[0]
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listLatestHealthChecks(): Promise<HealthCheckRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const services: HealthCheckService[] = ['surrealdb', 'restate', 'workflow-runtime', 'web-api']
    const latest: HealthCheckRecord[] = []
    for (const service of services) {
      const [result] = await surreal.query<[HealthCheckRecord[]]>(
        'SELECT * FROM health_checks WHERE service = $service ORDER BY checkedAt DESC LIMIT 1',
        { service }
      )
      if (result?.[0]) latest.push(result[0])
    }
    return latest
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listHealthCheckHistory(limit: number): Promise<HealthCheckRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[HealthCheckRecord[]]>(
      'SELECT * FROM health_checks ORDER BY checkedAt DESC LIMIT $limit',
      { limit }
    )
    return result ?? []
  } finally {
    await closeSurreal(surreal)
  }
}

export async function pruneHealthChecks(service: HealthCheckService, keep: number): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query(
      `DELETE FROM health_checks WHERE service = $service AND id NOT IN (
         SELECT id FROM health_checks WHERE service = $service ORDER BY checkedAt DESC LIMIT $keep
       )`,
      { service, keep }
    )
  } finally {
    await closeSurreal(surreal)
  }
}
```

- [ ] **Step 2: Export from db package**

Add to `packages/db/package.json` under `exports`:

```json
"./health-checks": {
  "types": "./dist/health-checks.d.ts",
  "default": "./dist/health-checks.js"
}
```

- [ ] **Step 3: Build the db package**

Run:
```bash
pnpm --filter db build
```

Expected: TypeScript compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/health-checks.ts packages/db/package.json
git commit -m "feat(db): add health_checks CRUD"
```

---

### Task 2: workflow-runtime — add `/health` endpoint

**Files:**
- Modify: `apps/workflow-runtime/src/index.ts`
- Test: `pnpm --filter workflow-runtime build`

- [ ] **Step 1: Replace `apps/workflow-runtime/src/index.ts`**

```ts
import * as restate from '@restatedev/restate-sdk'
import http from 'node:http'
import { workflowObject } from './workflow.js'

const handler = restate.endpoint().bind(workflowObject).handler()

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }
  handler(req, res)
})

server.listen(9080, () => {
  console.log('Workflow runtime listening on 9080')
})
```

- [ ] **Step 2: Build the workflow-runtime package**

Run:
```bash
pnpm --filter workflow-runtime build
```

Expected: TypeScript compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/workflow-runtime/src/index.ts
git commit -m "feat(workflow-runtime): add /health endpoint alongside Restate handler"
```

---

### Task 3: web app — add `/api/health` endpoint

**Files:**
- Create: `apps/web/server/api/health.get.ts`
- Test: `pnpm --filter web build`

- [ ] **Step 1: Create `apps/web/server/api/health.get.ts`**

```ts
export default defineEventHandler(() => {
  return { status: 'ok' }
})
```

- [ ] **Step 2: Build the web app**

Run:
```bash
pnpm --filter web build
```

Expected: Nuxt build completes successfully.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/api/health.get.ts
git commit -m "feat(web): add public /api/health endpoint"
```

---

### Task 4: admin app — add health check runner utility

**Files:**
- Create: `apps/admin/server/utils/health-monitor.ts`
- Test: `pnpm --filter admin build`

- [ ] **Step 1: Create `apps/admin/server/utils/health-monitor.ts`**

```ts
import { getSurreal, closeSurreal } from 'db/client'
import type { HealthCheckService, HealthCheckStatus } from 'db/health-checks'

const CHECK_TIMEOUT_MS = 5000

interface CheckResult {
  service: HealthCheckService
  status: HealthCheckStatus
  responseTimeMs: number
  message?: string
  details?: Record<string, unknown>
}

function getEnv(name: string): string | undefined {
  return process.env[name]
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout])
}

async function checkSurrealDB(): Promise<CheckResult> {
  const service: HealthCheckService = 'surrealdb'
  const url = getEnv('SURREAL_URL')
  const user = getEnv('SURREAL_USER')
  const pass = getEnv('SURREAL_PASS')
  if (!url || !user || !pass) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing SurrealDB env vars' }
  }
  const start = Date.now()
  try {
    const surreal = await getSurreal('platform', 'admin')
    try {
      await surreal.query('SELECT 1 FROM 1')
      return { service, status: 'healthy', responseTimeMs: Date.now() - start }
    } finally {
      await closeSurreal(surreal)
    }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
}

async function checkRestate(): Promise<CheckResult> {
  const service: HealthCheckService = 'restate'
  const url = getEnv('RESTATE_META_URL')
  if (!url) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing RESTATE_META_URL' }
  }
  const start = Date.now()
  try {
    const res = await withTimeout(fetch(`${url}/services`), CHECK_TIMEOUT_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
}

async function checkWorkflowRuntime(): Promise<CheckResult> {
  const service: HealthCheckService = 'workflow-runtime'
  const url = getEnv('WORKFLOW_RUNTIME_URL')
  if (!url) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing WORKFLOW_RUNTIME_URL' }
  }
  const start = Date.now()
  try {
    const res = await withTimeout(fetch(`${url}/health`), CHECK_TIMEOUT_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
}

async function checkWebApi(): Promise<CheckResult> {
  const service: HealthCheckService = 'web-api'
  const url = getEnv('WEB_API_URL')
  if (!url) {
    return { service, status: 'unhealthy', responseTimeMs: 0, message: 'Missing WEB_API_URL' }
  }
  const start = Date.now()
  try {
    const res = await withTimeout(fetch(`${url}/api/health`), CHECK_TIMEOUT_MS)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { service, status: 'healthy', responseTimeMs: Date.now() - start }
  } catch (err) {
    return { service, status: 'unhealthy', responseTimeMs: Date.now() - start, message: err instanceof Error ? err.message : String(err) }
  }
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

- [ ] **Step 2: Build the admin app**

Run:
```bash
pnpm --filter admin build
```

Expected: TypeScript compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/server/utils/health-monitor.ts
git commit -m "feat(admin): add health check runner utility"
```

---

### Task 5: admin app — add scheduler plugin

**Files:**
- Create: `apps/admin/server/plugins/health-monitor-scheduler.ts`
- Test: `pnpm --filter admin build`

- [ ] **Step 1: Create `apps/admin/server/plugins/health-monitor-scheduler.ts`**

```ts
import { runHealthChecks } from '#server/utils/health-monitor'
import { createHealthCheck, pruneHealthChecks } from 'db/health-checks'

const INTERVAL_MS = Number(process.env.HEALTH_CHECK_INTERVAL_MS ?? '60000')
const HISTORY_LIMIT = Number(process.env.HEALTH_CHECK_HISTORY_LIMIT ?? '100')

export default defineNitroPlugin(() => {
  async function tick() {
    try {
      const results = await runHealthChecks()
      for (const result of results) {
        await createHealthCheck({
          service: result.service,
          status: result.status,
          checkedAt: new Date().toISOString(),
          responseTimeMs: result.responseTimeMs,
          message: result.message,
          details: result.details
        })
        await pruneHealthChecks(result.service, HISTORY_LIMIT)
      }
    } catch (err) {
      console.error('Health monitor tick failed:', err)
    }
  }

  tick().catch(console.error)
  setInterval(tick, INTERVAL_MS)
})
```

- [ ] **Step 2: Build the admin app**

Run:
```bash
pnpm --filter admin build
```

Expected: TypeScript compiles with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/server/plugins/health-monitor-scheduler.ts
git commit -m "feat(admin): add health monitor scheduler plugin"
```

---

### Task 6: admin app — add API routes

**Files:**
- Create: `apps/admin/server/api/health-checks/index.get.ts`
- Create: `apps/admin/server/api/health-checks/run.post.ts`
- Test: `pnpm --filter admin build`

- [ ] **Step 1: Create `apps/admin/server/api/health-checks/index.get.ts`**

```ts
import { listHealthCheckHistory, listLatestHealthChecks } from 'db/health-checks'
import { requireAdminSession } from '#server/utils/session'

const HISTORY_LIMIT = Number(process.env.HEALTH_CHECK_HISTORY_LIMIT ?? '100')

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const [latest, history] = await Promise.all([
    listLatestHealthChecks(),
    listHealthCheckHistory(HISTORY_LIMIT)
  ])
  return { latest, history }
})
```

- [ ] **Step 2: Create `apps/admin/server/api/health-checks/run.post.ts`**

```ts
import { runHealthChecks } from '#server/utils/health-monitor'
import { createHealthCheck, pruneHealthChecks } from 'db/health-checks'
import { requireAdminSession } from '#server/utils/session'

const HISTORY_LIMIT = Number(process.env.HEALTH_CHECK_HISTORY_LIMIT ?? '100')

export default defineEventHandler(async (event) => {
  requireAdminSession(event)
  const results = await runHealthChecks()
  const records = await Promise.all(
    results.map(async (result) => {
      const record = await createHealthCheck({
        service: result.service,
        status: result.status,
        checkedAt: new Date().toISOString(),
        responseTimeMs: result.responseTimeMs,
        message: result.message,
        details: result.details
      })
      await pruneHealthChecks(result.service, HISTORY_LIMIT)
      return record
    })
  )
  return records
})
```

- [ ] **Step 3: Build the admin app**

Run:
```bash
pnpm --filter admin build
```

Expected: TypeScript compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/server/api/health-checks
git commit -m "feat(admin): add health-checks API routes"
```

---

### Task 7: admin app — add health page and nav link

**Files:**
- Create: `apps/admin/app/pages/health.vue`
- Modify: `apps/admin/app/layouts/default.vue`
- Test: `pnpm --filter admin build`

- [ ] **Step 1: Create `apps/admin/app/pages/health.vue`**

```vue
<script setup lang="ts">
import type { HealthCheckRecord } from 'db/health-checks'

interface HealthCheckData {
  latest: HealthCheckRecord[]
  history: HealthCheckRecord[]
}

const { data, refresh } = await useFetch<HealthCheckData>('/api/health-checks')
const running = ref(false)

async function runNow() {
  running.value = true
  try {
    await $fetch('/api/health-checks/run', { method: 'POST' })
    await refresh()
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Health Monitor</h1>
      <button
        :disabled="running"
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        @click="runNow"
      >
        {{ running ? 'Running...' : 'Run checks now' }}
      </button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="check in data?.latest ?? []"
        :key="check.service"
        class="bg-white p-4 rounded shadow"
      >
        <div class="text-sm text-gray-500 capitalize">{{ check.service }}</div>
        <div class="flex items-center gap-2 mt-1">
          <span
            class="inline-block w-3 h-3 rounded-full"
            :class="check.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'"
          />
          <span class="text-lg font-semibold capitalize">{{ check.status }}</span>
        </div>
        <div class="text-xs text-gray-400 mt-2">{{ new Date(check.checkedAt).toLocaleString() }}</div>
        <div class="text-xs text-gray-500 mt-1">{{ check.responseTimeMs }}ms</div>
        <div v-if="check.message" class="text-xs text-red-600 mt-2">{{ check.message }}</div>
      </div>
    </div>

    <div class="bg-white rounded shadow overflow-hidden">
      <h2 class="font-semibold p-4 border-b">History</h2>
      <table class="w-full text-sm text-left">
        <thead class="bg-gray-50 text-gray-600">
          <tr>
            <th class="px-4 py-2">Service</th>
            <th class="px-4 py-2">Status</th>
            <th class="px-4 py-2">Checked At</th>
            <th class="px-4 py-2">Response Time</th>
            <th class="px-4 py-2">Message</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.history ?? []" :key="row.id" class="border-b">
            <td class="px-4 py-2 capitalize">{{ row.service }}</td>
            <td class="px-4 py-2">
              <span
                class="inline-block w-2 h-2 rounded-full mr-1"
                :class="row.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'"
              />
              {{ row.status }}
            </td>
            <td class="px-4 py-2">{{ new Date(row.checkedAt).toLocaleString() }}</td>
            <td class="px-4 py-2">{{ row.responseTimeMs }}ms</td>
            <td class="px-4 py-2 text-red-600">{{ row.message ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Modify `apps/admin/app/layouts/default.vue`**

Add the Health nav link next to Triggers:

```vue
<NuxtLink to="/health" class="text-sm text-gray-600 hover:text-gray-900">Health</NuxtLink>
```

- [ ] **Step 3: Build the admin app**

Run:
```bash
pnpm --filter admin build
```

Expected: TypeScript compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/pages/health.vue apps/admin/app/layouts/default.vue
git commit -m "feat(admin): add health monitor page and navigation"
```

---

### Task 8: Configure environment variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add new variables to `.env.example`**

Append after the existing content:

```bash
# Health monitor
RESTATE_META_URL=http://localhost:9070
WORKFLOW_RUNTIME_URL=http://localhost:9080
WEB_API_URL=http://localhost:3000
HEALTH_CHECK_INTERVAL_MS=60000
HEALTH_CHECK_HISTORY_LIMIT=100
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add health monitor env vars to example"
```

---

### Task 9: Full build verification

- [ ] **Step 1: Run the full monorepo build**

```bash
pnpm -r build
```

Expected: all packages and apps build successfully.

- [ ] **Step 2: Commit if any lockfile or generated changes appeared**

```bash
git diff --stat
# if pnpm-lock.yaml or other files changed, stage and commit
git commit -m "chore: update lockfile after health monitor deps"
```

---

### Task 10: Manual smoke test

Prerequisites: Docker running with `docker compose up -d`, services registered with Restate.

- [ ] **Step 1: Start the admin app**

```bash
pnpm --filter admin dev
```

- [ ] **Step 2: Open the health page**

Navigate to `http://localhost:3001/health` and log in with the seeded admin credentials.

- [ ] **Step 3: Verify initial data**

The page should show status cards for SurrealDB, Restate, workflow-runtime, and web-api. Because the scheduler runs on startup, latest results should appear within `HEALTH_CHECK_INTERVAL_MS` (default 60s), or immediately after clicking **Run checks now**.

- [ ] **Step 4: Test failure scenario**

Stop one service, e.g.:

```bash
docker compose stop workflow-runtime
```

Click **Run checks now**. The workflow-runtime card should turn red and the history table should show an unhealthy record.

Restart it after testing:

```bash
docker compose start workflow-runtime
```

Remember to re-register the workflow service with Restate if you recreated the container:

```bash
curl -X POST http://localhost:9070/endpoints -H 'content-type: application/json' -d '{"uri": "http://host.docker.internal:9080"}'
```

---

### Task 11: Documentation

**Files:**
- Create: `docs/50-Features/Admin Health Monitor.md`
- Modify: `docs/30-Apps/Admin App/Overview.md`

- [ ] **Step 1: Create `docs/50-Features/Admin Health Monitor.md`**

```markdown
---
title: Admin Health Monitor
type: feature
status: done
area: admin
app:
  - admin
created: 2026-06-15
updated: 2026-06-15
related:
  - [[30-Apps/Admin App/Overview]]
  - [[Workflow Runtime]]
  - [[40-Packages/db]]
---

# Admin Health Monitor

## Overview

Superadmins can view the health of core platform services from the admin app. A background scheduler runs periodic checks and stores the results in SurrealDB.

## Monitored services

- SurrealDB
- Restate
- workflow-runtime
- web API

## Admin page

`/health` shows:

- Current status cards for each service.
- Recent check history table.
- A manual "Run checks now" button.

## Configuration

See `.env.example`:

- `RESTATE_META_URL`
- `WORKFLOW_RUNTIME_URL`
- `WEB_API_URL`
- `HEALTH_CHECK_INTERVAL_MS`
- `HEALTH_CHECK_HISTORY_LIMIT`

## Future scaling

The check runner is isolated from the scheduler. To scale the admin app behind a load balancer, move `server/utils/health-monitor.ts` and the scheduler plugin into a standalone Docker service. The admin app and DB schema stay the same.

## Related

- [[30-Apps/Admin App/Overview|Admin App]]
- [[Workflow Runtime|Workflow Runtime architecture]]
- [[40-Packages/db|db package]]
```

- [ ] **Step 2: Update `docs/30-Apps/Admin App/Overview.md`**

Add to the routes table:

```markdown
| Route | Purpose |
|-------|---------|
| `/health` | Service health monitor. |
```

Update the `updated:` frontmatter date to `2026-06-15`.

- [ ] **Step 3: Run frontmatter normalization**

```bash
node docs/scripts/apply-frontmatter.cjs --force
```

- [ ] **Step 4: Commit**

```bash
git add docs/50-Features/Admin Health Monitor.md "docs/30-Apps/Admin App/Overview.md"
git commit -m "docs: add admin health monitor feature note"
```

---

## Self-review

- [ ] Spec coverage: every requirement in `docs/superpowers/specs/2026-06-15-admin-health-monitor-design.md` maps to a task above.
- [ ] Placeholder scan: no TBD/TODO/"implement later" items.
- [ ] Type consistency: `HealthCheckService`, `HealthCheckStatus`, `HealthCheckRecord`, `HealthCheckInput` are used consistently across db, admin utility, scheduler, API, and UI.
