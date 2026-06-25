---
title: Health Check Startup Refresh Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-25
updated: 2026-06-25
---

# Health Check Startup Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an HTTP endpoint to the standalone `health-monitor` service so other services can request an immediate refresh, and wire the API server and admin UI to use it.

**Architecture:** `apps/health-monitor` exposes `POST /refresh` via `Bun.serve` alongside its scheduler loop. `apps/api` calls this endpoint on startup and forwards admin requests through `POST /api/admin/health-checks/refresh`. `apps/admin` adds a **Refresh now** button that hits the API endpoint.

**Tech Stack:** TypeScript, Bun, Hono, Nuxt/Vue, SurrealDB via `db` package.

---

### Task 1: Add single-service check to runner

**Files:**
- Modify: `apps/health-monitor/src/runner.ts`

- [ ] **Step 1: Add valid services and single-service runner**

Append to `apps/health-monitor/src/runner.ts` after the existing `runHealthChecks` function:

```ts
export const VALID_SERVICES: HealthCheckService[] = ['surrealdb', 'restate', 'workflow-runtime', 'api']

export async function runHealthCheckForService(service: HealthCheckService): Promise<CheckResult> {
  switch (service) {
    case 'surrealdb':
      return checkSurrealDB()
    case 'restate':
      return checkRestate()
    case 'workflow-runtime':
      return checkWorkflowRuntime()
    case 'api':
      return checkApi()
    default:
      throw new Error(`Unknown service: ${service}`)
  }
}
```

- [ ] **Step 2: Type-check the health-monitor package**

```bash
pnpm --filter health-monitor typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/health-monitor/src/runner.ts
git commit -m "feat(health-monitor): support running a single service check"
```

---

### Task 2: Add `Bun.serve` refresh endpoint to health-monitor

**Files:**
- Modify: `apps/health-monitor/src/index.ts`

- [ ] **Step 1: Replace the scheduler-only entry point with scheduler + server**

Rewrite `apps/health-monitor/src/index.ts` to:

```ts
import { runHealthChecks, runHealthCheckForService, VALID_SERVICES } from './runner.js'
import { createHealthCheck, pruneHealthChecksByAge, type HealthCheckRecord, type HealthCheckService } from 'db/health-checks'

const DEFAULT_INTERVAL_MS = 60_000
const DEFAULT_RETENTION_DAYS = 365
const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_PORT = 3010

function parseRetentionDays(value: string | undefined): number {
  const trimmed = value?.trim()
  if (trimmed === undefined || trimmed === '') return DEFAULT_RETENTION_DAYS * MS_PER_DAY
  const parsed = Number(trimmed)
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS
  return days * MS_PER_DAY
}

function parseIntervalMs(value: string | undefined): number | null {
  const trimmed = value?.trim()
  if (trimmed === '0') return null
  if (trimmed === undefined || trimmed === '') return DEFAULT_INTERVAL_MS
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INTERVAL_MS
}

const INTERVAL_MS = parseIntervalMs(process.env.HEALTH_CHECK_INTERVAL_MS)
const RETENTION_MS = parseRetentionDays(process.env.HEALTH_CHECK_RETENTION_DAYS)
const PORT = Number(process.env.HEALTH_MONITOR_PORT ?? DEFAULT_PORT)

if (INTERVAL_MS === null) {
  console.log('Health monitor scheduler disabled (HEALTH_CHECK_INTERVAL_MS=0)')
}

let isRunning = false
let isShuttingDown = false

async function refresh(service?: HealthCheckService): Promise<HealthCheckRecord[]> {
  const results = service === undefined
    ? await runHealthChecks()
    : [await runHealthCheckForService(service)]

  const records: HealthCheckRecord[] = []
  for (const result of results) {
    try {
      const record = await createHealthCheck({
        service: result.service,
        status: result.status,
        checkedAt: new Date().toISOString(),
        responseTimeMs: result.responseTimeMs,
        message: result.message,
        details: result.details
      })
      await pruneHealthChecksByAge(result.service, RETENTION_MS)
      records.push(record)
    } catch (err) {
      console.error(`Health monitor persistence failed for ${result.service}:`, err)
    }
  }
  return records
}

async function tick() {
  if (isRunning) {
    console.warn('Health monitor tick skipped: previous tick still running')
    return
  }
  if (isShuttingDown) return

  isRunning = true
  try {
    const records = await refresh()
    console.log(`Health monitor tick completed: ${records.length} services checked`)
  } catch (err) {
    console.error('Health monitor tick failed:', err)
  } finally {
    isRunning = false
  }
}

function startScheduler() {
  if (INTERVAL_MS === null) return
  console.log(`Health monitor scheduler started: intervalMs=${INTERVAL_MS}, retentionDays=${RETENTION_MS / MS_PER_DAY}`)
  tick()
  return setInterval(tick, INTERVAL_MS)
}

function startServer() {
  console.log(`Health monitor server started on port ${PORT}`)
  return Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url)
      if (req.method !== 'POST' || url.pathname !== '/refresh') {
        return new Response('Not found', { status: 404 })
      }

      let body: Record<string, unknown> = {}
      try {
        body = await req.json()
      } catch {
        // ignore empty/invalid body
      }

      const service = body.service
      if (service !== undefined && (typeof service !== 'string' || !VALID_SERVICES.includes(service as HealthCheckService))) {
        return Response.json({ error: 'Invalid service' }, { status: 400 })
      }

      try {
        const records = await refresh(service as HealthCheckService | undefined)
        return Response.json({ results: records })
      } catch (err) {
        console.error('Health monitor refresh failed:', err)
        return Response.json({ error: 'Refresh failed' }, { status: 500 })
      }
    },
  })
}

let shutdownTimer: ReturnType<typeof setTimeout> | undefined

function shutdown(signal: string) {
  if (isShuttingDown) return
  console.log(`Health monitor received ${signal}, shutting down...`)
  isShuttingDown = true
  if (interval) {
    clearInterval(interval)
  }
  shutdownTimer = setTimeout(() => {
    console.error('Health monitor shutdown timed out; forcing exit')
    process.exit(1)
  }, 30_000)
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
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})

const interval = startScheduler()
startServer()
```

- [ ] **Step 2: Type-check the health-monitor package**

```bash
pnpm --filter health-monitor typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/health-monitor/src/index.ts
git commit -m "feat(health-monitor): add Bun.serve /refresh endpoint"
```

---

### Task 3: Trigger startup refresh from API

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add `HEALTH_MONITOR_URL` to `.env.example`**

Add after the `API_URL` block in `.env.example`:

```bash
HEALTH_MONITOR_URL=http://localhost:3010
HEALTH_MONITOR_PORT=3010
```

- [ ] **Step 2: Add startup refresh trigger to API**

Replace `apps/api/src/index.ts` with:

```ts
import { serve } from '@hono/node-server'
import { createApp } from './app.js'

const port = Number(process.env.API_PORT ?? '3002')
const app = createApp()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`)

  const healthMonitorUrl = process.env.HEALTH_MONITOR_URL
  if (healthMonitorUrl) {
    fetch(`${healthMonitorUrl}/refresh`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          console.warn(`Startup health refresh failed: HTTP ${res.status}`)
          return
        }
        console.log('Startup health refresh triggered')
      })
      .catch((err) => {
        console.warn('Failed to reach health-monitor on startup:', err instanceof Error ? err.message : String(err))
      })
  }
})
```

- [ ] **Step 3: Type-check the API package**

```bash
pnpm --filter api typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/index.ts .env.example
git commit -m "feat(api): trigger health refresh on startup"
```

---

### Task 4: Add admin refresh endpoint

**Files:**
- Modify: `apps/api/src/routes/admin.ts`

- [ ] **Step 1: Add `POST /health-checks/refresh`**

Add after the existing `GET /health-checks/history` route in `apps/api/src/routes/admin.ts`:

```ts
app.post('/health-checks/refresh', requireAdminPermission('platform', 'view'), async (c) => {
  const healthMonitorUrl = process.env.HEALTH_MONITOR_URL
  if (!healthMonitorUrl) {
    return c.json({ error: 'Health monitor not configured' }, 503)
  }

  let body: Record<string, unknown> = {}
  try {
    body = await c.req.json()
  } catch {
    // ignore empty/invalid body
  }

  const service = body.service
  if (service !== undefined && (typeof service !== 'string' || !VALID_SERVICES.includes(service as HealthCheckService))) {
    return c.json({ error: 'Invalid service' }, 400)
  }

  try {
    const res = await fetch(`${healthMonitorUrl}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(service === undefined ? {} : { service }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => 'Health monitor unavailable')
      return c.json({ error: text }, 502)
    }

    const data = await res.json() as { results: unknown }
    return c.json(data)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Health monitor unavailable' }, 502)
  }
})
```

The `VALID_SERVICES` constant already exists at line 29 of `apps/api/src/routes/admin.ts`; no new import is needed.

- [ ] **Step 2: Type-check the API package**

```bash
pnpm --filter api typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/admin.ts
git commit -m "feat(api): add admin endpoint to refresh health checks"
```

---

### Task 5: Add Refresh now button to admin UI

**Files:**
- Modify: `apps/admin/app/pages/health.vue`

- [ ] **Step 1: Add refresh-now state and handler**

Add these refs and function inside `<script setup>` in `apps/admin/app/pages/health.vue`, after the existing `refresh()` function:

```ts
const refreshNowPending = ref(false)
const refreshNowError = ref<string | null>(null)

async function refreshNow(service?: HealthCheckService) {
  refreshNowPending.value = true
  refreshNowError.value = null
  try {
    await api.fetch('/api/admin/health-checks/refresh', {
      method: 'POST',
      body: service ? { service } : undefined,
    })
    await refresh()
  } catch (err) {
    refreshNowError.value = err instanceof Error ? err.message : String(err)
  } finally {
    refreshNowPending.value = false
  }
}
```

- [ ] **Step 2: Add the Refresh now button**

Replace the existing button block in the template (lines 101–109) with:

```vue
<div class="flex items-center justify-end gap-2">
  <button
    :disabled="refreshNowPending"
    class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
    @click="refreshNow()"
  >
    {{ refreshNowPending ? 'Refreshing...' : 'Refresh now' }}
  </button>
  <button
    :disabled="pending"
    class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
    @click="refresh()"
  >
    {{ pending ? 'Refreshing...' : 'Refresh' }}
  </button>
</div>
```

- [ ] **Step 3: Display refresh-now errors**

Add this block right after the existing error display:

```vue
<div v-if="refreshNowError" class="text-red-600">Refresh failed: {{ refreshNowError }}</div>
```

- [ ] **Step 4: Type-check the admin package**

```bash
pnpm --filter admin typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/pages/health.vue
git commit -m "feat(admin): add refresh-now button for health checks"
```

---

### Task 6: Update Docker Compose wiring

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Expose health-monitor port and env vars**

In `docker-compose.yml`, update the `health-monitor` service:

```yaml
  health-monitor:
    build:
      context: .
      dockerfile: apps/health-monitor/Dockerfile
    env_file: .env
    environment:
      - SURREAL_URL=ws://surrealdb:8000/rpc
      - RESTATE_META_URL=http://restate:9070
      - WORKFLOW_RUNTIME_URL=http://workflow-runtime:9080
      - API_URL=http://host.docker.internal:3002
      - HEALTH_CHECK_INTERVAL_MS=1800000
      - HEALTH_CHECK_RETENTION_DAYS=365
      - HEALTH_MONITOR_PORT=3010
    ports:
      - "3010:3010"
    depends_on:
      - surrealdb
      - restate
      - workflow-runtime
    restart: unless-stopped
```

Update the `api` service environment to include `HEALTH_MONITOR_URL`:

```yaml
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    env_file: .env
    environment:
      - SURREAL_URL=ws://surrealdb:8000/rpc
      - SURREAL_USER=root
      - SURREAL_PASS=root
      - WEB_URL=http://host.docker.internal:3000
      - ADMIN_URL=http://host.docker.internal:3001
      - HEALTH_MONITOR_URL=http://health-monitor:3010
    ports:
      - "3002:3002"
    depends_on:
      - surrealdb
      - health-monitor
    restart: unless-stopped
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(compose): wire health-monitor HTTP endpoint"
```

---

### Task 7: Update documentation

**Files:**
- Modify: `docs/50-Features/Admin Health Monitor.md`
- Modify: `docs/30-Apps/Health Monitor/Overview.md`

- [ ] **Step 1: Update `docs/50-Features/Admin Health Monitor.md`**

Add after the `## API` section:

```markdown
## Refresh

- The API server triggers a refresh on startup so the health page shows status immediately.
- `POST /api/admin/health-checks/refresh` requests an immediate refresh from the health-monitor service.
- The admin `/health` page has a **Refresh now** button that calls this endpoint.
```

Update the `## Configuration` section to include:

```markdown
- `HEALTH_MONITOR_URL` — URL the API uses to reach the health-monitor service.
- `HEALTH_MONITOR_PORT` — Port the health-monitor HTTP server binds to.
```

- [ ] **Step 2: Update `docs/30-Apps/Health Monitor/Overview.md`**

Add after the `## Key behaviors` section:

```markdown
- Exposes an internal HTTP endpoint (`POST /refresh`) so other services can request an immediate refresh.
- Accepts an optional `{ service }` body to refresh a single service; without it, refreshes all services.
```

- [ ] **Step 3: Commit**

```bash
git add docs/
git commit -m "docs: health-monitor refresh endpoint and startup trigger"
```

---

### Task 8: Verify build and smoke-test

**Files:**
- None

- [ ] **Step 1: Install dependencies**

```bash
pnpm install
```

Expected: lockfile updated if needed, all workspace links resolved.

- [ ] **Step 2: Type-check affected packages**

```bash
pnpm --filter health-monitor typecheck
pnpm --filter api typecheck
pnpm --filter admin typecheck
```

Expected: no TypeScript errors in any of the three.

- [ ] **Step 3: Build the workspace**

```bash
pnpm -r build
```

Expected: all packages and apps build successfully.

- [ ] **Step 4: Smoke-test the endpoint (requires running infrastructure)**

Start infrastructure and services:

```bash
docker compose up -d
pnpm --filter health-monitor dev
```

In another terminal, call the refresh endpoint directly:

```bash
curl -X POST http://localhost:3010/refresh -H 'Content-Type: application/json' -d '{"service":"api"}'
```

Expected: JSON response with an updated `api` health-check record.

Start the API:

```bash
pnpm --filter api dev
```

Expected: API logs show `Startup health refresh triggered` or a warning if health-monitor is unreachable.

Start the admin app:

```bash
pnpm --filter admin dev
```

Open `http://localhost:3001/health`, click **Refresh now**, and confirm the timestamps update.

- [ ] **Step 5: Commit any final fixes**

If any fixes were needed during verification, commit them now.

---

## Self-review checklist

- [x] Spec coverage: `Bun.serve` `/refresh` endpoint, API startup trigger, admin endpoint, admin UI button, env vars, Docker Compose, docs, verification.
- [x] No placeholders: every step contains exact file paths, code, and commands.
- [x] Type consistency: `HealthCheckService`, `VALID_SERVICES`, env var names, and endpoint paths match the spec.
