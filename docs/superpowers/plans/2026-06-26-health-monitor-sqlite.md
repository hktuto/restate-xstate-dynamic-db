# Health-monitor SQLite storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `apps/health-monitor` from SurrealDB-backed `health_checks` storage to a local SQLite database using `bun:sqlite`, expose the data via HTTP, and retire the `packages/db` SurrealDB health-check module.

**Architecture:** A new `bun:sqlite` module inside `apps/health-monitor` replaces `packages/db/src/health-checks.ts`. The health-monitor HTTP server adds JSON endpoints for readers and an HTML status page. `apps/api` and `packages/db/src/platform-status.ts` read from those endpoints instead of SurrealDB. The obsolete SurrealDB table, indexes, schema-registry entry, and tests are removed.

**Tech Stack:** Bun, `bun:sqlite`, TypeScript, `fetch`, Docker Compose.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/health-monitor/src/types.ts` | Create | Shared types (`HealthCheckService`, `HealthCheckStatus`, `HealthCheckInput`, `HealthCheckRecord`). |
| `apps/health-monitor/src/db.ts` | Create | SQLite DDL and CRUD/prune operations. |
| `apps/health-monitor/src/db.test.ts` | Create | Bun-native tests for the SQLite module. |
| `apps/health-monitor/src/runner.ts` | Modify | Stop importing from `db/health-checks`; import local types. |
| `apps/health-monitor/src/index.ts` | Modify | Wire SQLite module into scheduler; add `/api/health-checks`, `/api/health-checks/history`, and `/status` routes. |
| `apps/health-monitor/package.json` | Modify | Add `test` script and `bun:test` types if needed. |
| `apps/api/src/routes/admin.ts` | Modify | Read health-check data from `HEALTH_MONITOR_URL` HTTP API. |
| `packages/db/src/platform-status.ts` | Modify | Read latest checks from `HEALTH_MONITOR_URL` HTTP API. |
| `packages/db/src/health-checks.ts` | Delete | Obsolete SurrealDB module. |
| `packages/db/test/health-checks.test.ts` | Delete | Obsolete tests. |
| `packages/db/src/schema-registry.ts` | Modify | Remove `health_checks` from `PLATFORM_TABLE_SCHEMAS`. |
| `packages/db/src/seed.ts` | Modify | Remove `health_checks` indexes. |
| `docker-compose.yml` | Modify | Drop SurrealDB env vars from health-monitor, add DB path + volume. |
| `.env.example` | Modify | Add `HEALTH_MONITOR_DB_PATH` and `HEALTH_MONITOR_URL` defaults. |

---

### Task 1: Create health-monitor types

**Files:**
- Create: `apps/health-monitor/src/types.ts`

- [ ] **Step 1: Write the types file**

```ts
export type HealthCheckService = 'surrealdb' | 'restate' | 'workflow-runtime' | 'api'
export type HealthCheckStatus = 'healthy' | 'unhealthy'

export interface HealthCheckInput {
  service: HealthCheckService
  status: HealthCheckStatus
  checkedAt: string
  responseTimeMs: number
  message?: string
  details?: Record<string, unknown>
}

export interface HealthCheckRecord extends HealthCheckInput {
  id: number
}
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run:

```bash
pnpm --filter health-monitor typecheck
```

Expected: command exits with code 0 (no new errors).

---

### Task 2: Create the SQLite module

**Files:**
- Create: `apps/health-monitor/src/db.ts`

- [ ] **Step 1: Write the SQLite module**

```ts
import { Database } from 'bun:sqlite'
import { mkdirSync, dirname } from 'node:path'
import type { HealthCheckInput, HealthCheckRecord, HealthCheckService } from './types.js'

const DEFAULT_DB_PATH = './data/health-monitor.sqlite'

function getDbPath(): string {
  return process.env.HEALTH_MONITOR_DB_PATH ?? DEFAULT_DB_PATH
}

function ensureDir(path: string): void {
  const dir = dirname(path)
  if (dir && dir !== '.') {
    mkdirSync(dir, { recursive: true })
  }
}

function initDb(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT NOT NULL,
      status TEXT NOT NULL,
      checkedAt TEXT NOT NULL,
      responseTimeMs INTEGER NOT NULL,
      message TEXT,
      details TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_health_checks_service_checkedAt ON health_checks (service, checkedAt);
    CREATE INDEX IF NOT EXISTS idx_health_checks_checkedAt ON health_checks (checkedAt);
  `)
}

let db: Database | undefined

export function getDatabase(): Database {
  if (!db) {
    const path = getDbPath()
    ensureDir(path)
    db = new Database(path)
    initDb(db)
  }
  return db
}

export function closeDatabase(): void {
  db?.close()
  db = undefined
}

interface HealthCheckRow {
  id: number
  service: string
  status: string
  checkedAt: string
  responseTimeMs: number
  message: string | null
  details: string | null
}

function rowToRecord(row: HealthCheckRow): HealthCheckRecord {
  return {
    id: row.id,
    service: row.service as HealthCheckService,
    status: row.status as HealthCheckStatus,
    checkedAt: row.checkedAt,
    responseTimeMs: row.responseTimeMs,
    message: row.message ?? undefined,
    details: row.details ? (JSON.parse(row.details) as Record<string, unknown>) : undefined,
  }
}

export function createHealthCheck(input: HealthCheckInput): HealthCheckRecord {
  const database = getDatabase()
  const details = input.details === undefined ? null : JSON.stringify(input.details)
  const result = database.query<HealthCheckRow>(`
    INSERT INTO health_checks (service, status, checkedAt, responseTimeMs, message, details)
    VALUES ($service, $status, $checkedAt, $responseTimeMs, $message, $details)
    RETURNING id, service, status, checkedAt, responseTimeMs, message, details
  `).get({
    $service: input.service,
    $status: input.status,
    $checkedAt: input.checkedAt,
    $responseTimeMs: input.responseTimeMs,
    $message: input.message ?? null,
    $details: details,
  })

  if (!result) throw new Error('Failed to insert health check')
  return rowToRecord(result)
}

export function listLatestHealthChecks(): HealthCheckRecord[] {
  const database = getDatabase()
  const rows = database.query<HealthCheckRow>(`
    SELECT h.* FROM health_checks h
    INNER JOIN (
      SELECT service, MAX(checkedAt) AS maxCheckedAt
      FROM health_checks
      GROUP BY service
    ) latest ON h.service = latest.service AND h.checkedAt = latest.maxCheckedAt
    ORDER BY h.checkedAt DESC
  `).all()
  return rows.map(rowToRecord)
}

export function listHealthCheckHistory(service: HealthCheckService, limit: number): HealthCheckRecord[] {
  const database = getDatabase()
  const rows = database.query<HealthCheckRow, { $service: string; $limit: number }>(`
    SELECT id, service, status, checkedAt, responseTimeMs, message, details
    FROM health_checks
    WHERE service = $service
    ORDER BY checkedAt DESC
    LIMIT $limit
  `).all({ $service: service, $limit: limit })
  return rows.map(rowToRecord)
}

export function pruneHealthChecksByAge(service: HealthCheckService, retentionMs: number): void {
  const database = getDatabase()
  const cutoff = new Date(Date.now() - retentionMs).toISOString()
  database.run('DELETE FROM health_checks WHERE service = $service AND checkedAt < $cutoff', {
    $service: service,
    $cutoff: cutoff,
  })
}
```

- [ ] **Step 2: Verify the module typechecks**

Run:

```bash
pnpm --filter health-monitor typecheck
```

Expected: command exits with code 0 (any pre-existing errors are unchanged).

---

### Task 3: Add Bun-native tests for the SQLite module

**Files:**
- Create: `apps/health-monitor/src/db.test.ts`
- Modify: `apps/health-monitor/package.json`

- [ ] **Step 1: Add test script to package.json**

Change `apps/health-monitor/package.json` from:

```json
{
  "name": "health-monitor",
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  ...
}
```

To:

```json
{
  "name": "health-monitor",
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  ...
}
```

- [ ] **Step 2: Write the test file**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  createHealthCheck,
  listLatestHealthChecks,
  listHealthCheckHistory,
  pruneHealthChecksByAge,
  closeDatabase,
} from './db.js'

describe('health-check db', () => {
  beforeEach(() => {
    process.env.HEALTH_MONITOR_DB_PATH = ':memory:'
  })

  afterEach(() => {
    closeDatabase()
    delete process.env.HEALTH_MONITOR_DB_PATH
  })

  it('creates and retrieves the latest checks', () => {
    createHealthCheck({ service: 'api', status: 'healthy', checkedAt: '2026-06-26T00:00:00.000Z', responseTimeMs: 10 })
    createHealthCheck({ service: 'api', status: 'unhealthy', checkedAt: '2026-06-26T00:01:00.000Z', responseTimeMs: 20, message: 'timeout' })

    const latest = listLatestHealthChecks()
    expect(latest).toHaveLength(1)
    expect(latest[0].service).toBe('api')
    expect(latest[0].status).toBe('unhealthy')
  })

  it('returns history for a service', () => {
    createHealthCheck({ service: 'surrealdb', status: 'healthy', checkedAt: '2026-06-26T00:00:00.000Z', responseTimeMs: 5 })
    createHealthCheck({ service: 'surrealdb', status: 'healthy', checkedAt: '2026-06-26T00:01:00.000Z', responseTimeMs: 6 })

    const history = listHealthCheckHistory('surrealdb', 5)
    expect(history).toHaveLength(2)
    expect(history[0].checkedAt).toBe('2026-06-26T00:01:00.000Z')
  })

  it('prunes records older than retention', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    createHealthCheck({ service: 'restate', status: 'healthy', checkedAt: old, responseTimeMs: 1 })
    createHealthCheck({ service: 'restate', status: 'healthy', checkedAt: recent, responseTimeMs: 2 })

    pruneHealthChecksByAge('restate', 24 * 60 * 60 * 1000)
    const history = listHealthCheckHistory('restate', 10)
    expect(history).toHaveLength(1)
    expect(history[0].checkedAt).toBe(recent)
  })
})
```

- [ ] **Step 3: Run the tests**

Run:

```bash
pnpm --filter health-monitor test
```

Expected: all 3 tests pass.

---

### Task 4: Update runner.ts to use local types

**Files:**
- Modify: `apps/health-monitor/src/runner.ts`

- [ ] **Step 1: Replace the `db/health-checks` import**

Change line 2 from:

```ts
import type { HealthCheckInput, HealthCheckService } from 'db/health-checks'
```

To:

```ts
import type { HealthCheckInput, HealthCheckService } from './types.js'
```

- [ ] **Step 2: Verify typecheck**

Run:

```bash
pnpm --filter health-monitor typecheck
```

Expected: command exits with code 0.

---

### Task 5: Update index.ts to use SQLite and add new routes

**Files:**
- Modify: `apps/health-monitor/src/index.ts`

- [ ] **Step 1: Replace `db/health-checks` imports**

Change lines 1–2 from:

```ts
import { runHealthChecks, runHealthCheckForService, VALID_SERVICES } from './runner.js'
import { createHealthCheck, pruneHealthChecksByAge, type HealthCheckRecord, type HealthCheckService } from 'db/health-checks'
```

To:

```ts
import { runHealthChecks, runHealthCheckForService, VALID_SERVICES } from './runner.js'
import { createHealthCheck, listLatestHealthChecks, listHealthCheckHistory, pruneHealthChecksByAge } from './db.js'
import type { HealthCheckRecord, HealthCheckService } from './types.js'
```

- [ ] **Step 2: Update `refresh()` to call the SQLite module**

Inside `refresh()`, the loop already calls `createHealthCheck` and `pruneHealthChecksByAge`. The SQLite versions are synchronous, so remove the `await` keywords:

```ts
async function refresh(service?: HealthCheckService): Promise<HealthCheckRecord[]> {
  const results = service === undefined
    ? await runHealthChecks()
    : [await runHealthCheckForService(service)]

  const records: HealthCheckRecord[] = []
  for (const result of results) {
    try {
      const record = createHealthCheck({
        service: result.service,
        status: result.status,
        checkedAt: new Date().toISOString(),
        responseTimeMs: result.responseTimeMs,
        message: result.message,
        details: result.details
      })
      pruneHealthChecksByAge(result.service, RETENTION_MS)
      records.push(record)
    } catch (err) {
      console.error(`Health monitor persistence failed for ${result.service}:`, err)
    }
  }
  return records
}
```

- [ ] **Step 3: Extend the HTTP router**

Replace the `fetch` handler body in `startServer()` with a router that handles all paths. The simplest approach is to add a helper before `Bun.serve`:

```ts
function isValidService(value: string): value is HealthCheckService {
  return (VALID_SERVICES as string[]).includes(value)
}

function htmlStatusPage(checks: HealthCheckRecord[]): Response {
  const rows = checks
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    .map((c) => {
      const statusColor = c.status === 'healthy' ? 'green' : 'red'
      return `<tr>
        <td>${c.service}</td>
        <td style="color:${statusColor};font-weight:bold;">${c.status}</td>
        <td>${c.checkedAt}</td>
        <td>${c.responseTimeMs}ms</td>
        <td>${c.message ?? ''}</td>
      </tr>`
    })
    .join('')

  const allHealthy = checks.length > 0 && checks.every((c) => c.status === 'healthy')
  const overall = allHealthy ? 'healthy' : checks.length === 0 ? 'unknown' : 'degraded'

  const body = `<!doctype html>
<html>
  <head><title>Platform Health</title></head>
  <body>
    <h1>Platform Health — ${overall}</h1>
    <table border="1" cellpadding="8" cellspacing="0">
      <thead>
        <tr><th>Service</th><th>Status</th><th>Checked At</th><th>Response Time</th><th>Message</th></tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5">No checks available</td></tr>'}
      </tbody>
    </table>
  </body>
</html>`

  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
```

Then replace the current `fetch` implementation with:

```ts
async fetch(req) {
  const url = new URL(req.url)

  if (req.method === 'GET' && url.pathname === '/health') {
    return Response.json({ ok: true })
  }

  if (req.method === 'GET' && url.pathname === '/api/health-checks') {
    return Response.json({ latest: listLatestHealthChecks() })
  }

  if (req.method === 'GET' && url.pathname === '/api/health-checks/history') {
    const service = url.searchParams.get('service')
    if (!service || !isValidService(service)) {
      return Response.json({ error: 'Missing or invalid service' }, { status: 400 })
    }
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
    if (!Number.isFinite(limit) || limit <= 0) {
      return Response.json({ error: 'Invalid limit' }, { status: 400 })
    }
    return Response.json({ service, limit, history: listHealthCheckHistory(service, limit) })
  }

  if (req.method === 'GET' && url.pathname === '/status') {
    return htmlStatusPage(listLatestHealthChecks())
  }

  if (req.method !== 'POST' || url.pathname !== '/refresh') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // existing /refresh body parsing and runRefresh() handling stays here
}
```

- [ ] **Step 4: Verify typecheck**

Run:

```bash
pnpm --filter health-monitor typecheck
```

Expected: command exits with code 0.

---

### Task 6: Update API admin routes to read from health-monitor HTTP API

**Files:**
- Modify: `apps/api/src/routes/admin.ts`

- [ ] **Step 1: Remove the `db/health-checks` import**

Delete this line:

```ts
import { listLatestHealthChecks, listHealthCheckHistoryForService, type HealthCheckService } from 'db/health-checks'
```

- [ ] **Step 2: Add a local HealthCheckService type**

Add after the imports:

```ts
type HealthCheckService = 'surrealdb' | 'restate' | 'workflow-runtime' | 'api'
```

- [ ] **Step 3: Replace `GET /health-checks` implementation**

Change:

```ts
app.get('/health-checks', requireAdminPermission('platform', 'view'), async (c) => {
    const latest = await listLatestHealthChecks()
    return c.json({ latest })
  })
```

To:

```ts
app.get('/health-checks', requireAdminPermission('platform', 'view'), async (c) => {
    const healthMonitorUrl = process.env.HEALTH_MONITOR_URL
    if (!healthMonitorUrl) {
      return c.json({ error: 'Health monitor unavailable' }, 503)
    }
    try {
      const res = await fetch(new URL('/api/health-checks', healthMonitorUrl).toString(), {
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        console.warn(`Health monitor returned HTTP ${res.status}`)
        return c.json({ error: 'Health monitor returned an error' }, 502)
      }
      const data = await res.json() as { latest: unknown }
      return c.json({ latest: data.latest })
    } catch (err) {
      console.warn('Failed to reach health monitor:', err)
      return c.json({ error: 'Health monitor unavailable' }, 502)
    }
  })
```

- [ ] **Step 4: Replace `GET /health-checks/history` implementation**

Change:

```ts
app.get('/health-checks/history', requireAdminPermission('platform', 'view'), async (c) => {
    const service = c.req.query('service')
    if (typeof service !== 'string' || !VALID_SERVICES.includes(service as HealthCheckService)) {
      return c.json({ error: 'Missing or invalid service query parameter' }, 400)
    }

    const limit = parseInt(String(c.req.query('limit') ?? DEFAULT_LIMIT), 10)
    if (!Number.isFinite(limit) || limit <= 0 || Number.isNaN(limit)) {
      return c.json({ error: 'Invalid limit query parameter' }, 400)
    }

    const history = await listHealthCheckHistoryForService(service as HealthCheckService, limit)
    return c.json({
      service: service as HealthCheckService,
      limit,
      history,
    })
  })
```

To:

```ts
app.get('/health-checks/history', requireAdminPermission('platform', 'view'), async (c) => {
    const service = c.req.query('service')
    if (typeof service !== 'string' || !VALID_SERVICES.includes(service as HealthCheckService)) {
      return c.json({ error: 'Missing or invalid service query parameter' }, 400)
    }

    const limit = parseInt(String(c.req.query('limit') ?? DEFAULT_LIMIT), 10)
    if (!Number.isFinite(limit) || limit <= 0 || Number.isNaN(limit)) {
      return c.json({ error: 'Invalid limit query parameter' }, 400)
    }

    const healthMonitorUrl = process.env.HEALTH_MONITOR_URL
    if (!healthMonitorUrl) {
      return c.json({ error: 'Health monitor unavailable' }, 503)
    }

    try {
      const url = new URL('/api/health-checks/history', healthMonitorUrl)
      url.searchParams.set('service', service)
      url.searchParams.set('limit', String(limit))
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
      if (!res.ok) {
        console.warn(`Health monitor returned HTTP ${res.status}`)
        return c.json({ error: 'Health monitor returned an error' }, 502)
      }
      const data = await res.json() as { history: unknown }
      return c.json({
        service: service as HealthCheckService,
        limit,
        history: data.history,
      })
    } catch (err) {
      console.warn('Failed to reach health monitor:', err)
      return c.json({ error: 'Health monitor unavailable' }, 502)
    }
  })
```

- [ ] **Step 5: Verify API typechecks**

Run:

```bash
pnpm --filter api typecheck
```

Expected: command exits with code 0 (or same pre-existing errors as before).

---

### Task 7: Update platform-status to read from health-monitor

**Files:**
- Modify: `packages/db/src/platform-status.ts`

- [ ] **Step 1: Remove the health-checks import and define the type locally**

Delete:

```ts
import { listLatestHealthChecks, type HealthCheckRecord } from './health-checks.js'
```

Add at the top of the file:

```ts
type HealthCheckStatus = 'healthy' | 'unhealthy'

interface HealthCheckRecord {
  id: number | string
  service: string
  status: HealthCheckStatus
  checkedAt: string
  responseTimeMs: number
  message?: string
  details?: Record<string, unknown>
}
```

- [ ] **Step 2: Add a fetch helper and use it**

Add before `getPlatformStatus()`:

```ts
async function fetchLatestChecks(): Promise<HealthCheckRecord[]> {
  const url = process.env.HEALTH_MONITOR_URL
  if (!url) return []
  const res = await fetch(`${url}/api/health-checks`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Health monitor returned ${res.status}`)
  const data = await res.json() as { latest: HealthCheckRecord[] }
  return data.latest ?? []
}
```

Then change `getPlatformStatus()`:

```ts
export async function getPlatformStatus(): Promise<PlatformStatus> {
  let checks: HealthCheckRecord[]
  try {
    checks = await fetchLatestChecks()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { mode: 'normal', message: `Health checks unavailable: ${message}`, checks: [] }
  }
  // rest of function unchanged
}
```

- [ ] **Step 3: Verify db package typechecks**

Run:

```bash
pnpm --filter db typecheck
```

Expected: command exits with code 0.

---

### Task 8: Remove obsolete health-checks module and tests

**Files:**
- Delete: `packages/db/src/health-checks.ts`
- Delete: `packages/db/test/health-checks.test.ts`

- [ ] **Step 1: Delete the files**

```bash
rm packages/db/src/health-checks.ts packages/db/test/health-checks.test.ts
```

- [ ] **Step 2: Remove `health_checks` from schema-registry.ts**

In `packages/db/src/schema-registry.ts`, delete the entire object in `PLATFORM_TABLE_SCHEMAS` whose `name` is `'health_checks'` (lines 211–223).

- [ ] **Step 3: Remove `health_checks` indexes from seed.ts**

In `packages/db/src/seed.ts`, delete these two lines from the SurrealQL block:

```sql
DEFINE INDEX IF NOT EXISTS idx_health_checks_checkedAt ON health_checks FIELDS checkedAt;
DEFINE INDEX IF NOT EXISTS idx_health_checks_service_checkedAt ON health_checks FIELDS service, checkedAt;
```

- [ ] **Step 4: Verify db package typechecks and tests**

Run:

```bash
pnpm --filter db typecheck
pnpm --filter db test
```

Expected: typecheck passes; db tests pass (any failures are pre-existing).

---

### Task 9: Update Docker Compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Update the health-monitor service block**

Change the `health-monitor` service from:

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
      - "127.0.0.1:3010:3010"
    depends_on:
      - surrealdb
      - restate
      - workflow-runtime
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3010/health"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s
    restart: unless-stopped
```

To:

```yaml
  health-monitor:
    build:
      context: .
      dockerfile: apps/health-monitor/Dockerfile
    env_file: .env
    environment:
      - HEALTH_MONITOR_DB_PATH=/data/health-monitor.sqlite
      - RESTATE_META_URL=http://restate:9070
      - WORKFLOW_RUNTIME_URL=http://workflow-runtime:9080
      - API_URL=http://host.docker.internal:3002
      - HEALTH_CHECK_INTERVAL_MS=1800000
      - HEALTH_CHECK_RETENTION_DAYS=365
      - HEALTH_MONITOR_PORT=3010
    ports:
      - "127.0.0.1:3010:3010"
    volumes:
      - health-monitor-data:/data
    depends_on:
      - restate
      - workflow-runtime
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3010/health"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s
    restart: unless-stopped
```

- [ ] **Step 2: Add the volume declaration**

Add `health-monitor-data:` under the top-level `volumes:` section:

```yaml
volumes:
  surreal-data:
  surreal-test-data:
  restate-data:
  health-monitor-data:
```

---

### Task 10: Update environment example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add health-monitor defaults**

After the existing health-monitor block, add:

```env
# Health monitor
RESTATE_META_URL=http://localhost:9070
WORKFLOW_RUNTIME_URL=http://localhost:9080
HEALTH_MONITOR_URL=http://localhost:3010
HEALTH_MONITOR_PORT=3010
HEALTH_CHECK_INTERVAL_MS=60000
HEALTH_CHECK_RETENTION_DAYS=365
HEALTH_MONITOR_DB_PATH=./data/health-monitor.sqlite
```

Keep the existing `HEALTH_MONITOR_URL` if it is already present elsewhere.

---

### Task 11: Manual verification

- [ ] **Step 1: Run health-monitor SQLite tests**

```bash
pnpm --filter health-monitor test
```

Expected: 3 tests pass.

- [ ] **Step 2: Start health-monitor locally**

```bash
STATUS_PAGE_URL=https://status.example.com pnpm --filter health-monitor dev
```

Wait — health-monitor has no `dev` script. Run it directly with Bun:

```bash
cd apps/health-monitor
bun src/index.ts
```

- [ ] **Step 3: Verify the HTTP endpoints**

In another terminal:

```bash
curl http://localhost:3010/health
curl http://localhost:3010/api/health-checks
curl 'http://localhost:3010/api/health-checks/history?service=api&limit=5'
curl http://localhost:3010/status
```

Expected: `/health` returns `{ ok: true }`; `/api/health-checks` returns latest checks after the first scheduler tick or after `POST /refresh`; `/status` returns HTML.

- [ ] **Step 4: Verify the API proxy**

Start the API with `HEALTH_MONITOR_URL=http://localhost:3010` and hit:

```bash
curl http://localhost:3002/api/admin/health-checks
```

Expected: JSON response with `{ latest: [...] }`.

- [ ] **Step 5: Verify database persistence across restarts**

Stop health-monitor, restart it, and confirm `GET /api/health-checks` still returns previous records.

---

## Self-review checklist

- [ ] Spec coverage: SQLite module, HTTP endpoints, API consumer updates, db cleanup, Docker/env changes are all in the plan.
- [ ] Placeholder scan: no TBD, TODO, or vague steps.
- [ ] Type consistency: `HealthCheckRecord` and `HealthCheckService` types align across `types.ts`, `db.ts`, `runner.ts`, `index.ts`, `admin.ts`, and `platform-status.ts`.
