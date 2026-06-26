---
title: "Health-monitor SQLite storage"
type: note
status: in-progress
area: runtime
app:
  - health-monitor
created: 2026-06-26
updated: 2026-06-26
related:
  - [[30-Apps/Health Monitor/Overview]]
  - [[API]]
  - [[40-Packages/db]]
---

# Health-monitor SQLite storage

Move `apps/health-monitor` from SurrealDB-backed `health_checks` storage to a local SQLite database using `bun:sqlite`. This keeps the monitor operational even when SurrealDB is down, and exposes its data via HTTP so other services do not need SurrealDB to read health status.

## Context

- `apps/health-monitor` currently depends on `packages/db`, which stores `health_checks` in SurrealDB.
- The monitor's job is to *detect* outages, including SurrealDB outages. If SurrealDB is unreachable, the monitor cannot persist its own results.
- `apps/api` reads `health_checks` from SurrealDB via `packages/db/src/health-checks.ts` and proxies refresh calls to `apps/health-monitor`.
- `packages/db/src/platform-status.ts` derives the platform mode from the latest health checks.

## Goals

1. Remove SurrealDB persistence from `apps/health-monitor`.
2. Store health-check records in a local SQLite file using `bun:sqlite`.
3. Expose the records via `GET /api/health-checks` (JSON) for other services.
4. Add `GET /status` as a human-readable HTML status page.
5. Update `apps/api` and `packages/db/src/platform-status.ts` to read from the health-monitor HTTP API.
6. Remove the now-unused `health_checks` SurrealDB module, tests, and schema-registry entry from `packages/db`.

## Design

### 1. SQLite module in health-monitor

Create `apps/health-monitor/src/db.ts` using `bun:sqlite`. It manages a single `health_checks` table:

```ts
export interface HealthCheckRecord {
  id: number
  service: string
  status: 'healthy' | 'unhealthy'
  checkedAt: string
  responseTimeMs: number
  message?: string
  details?: string // JSON-stringified Record<string, unknown>
}
```

On module init it runs:

```sql
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
```

Functions:

- `createHealthCheck(input)` — insert a record and return it.
- `listLatestHealthChecks()` — latest record per service.
- `listHealthCheckHistory(service, limit)` — history for one service.
- `pruneHealthChecksByAge(service, retentionMs)` — delete records older than the cutoff.

The database file path comes from `HEALTH_MONITOR_DB_PATH` (default `./data/health-monitor.sqlite`). The directory is created on startup if missing.

### 2. Health-monitor HTTP endpoints

`apps/health-monitor/src/index.ts` currently serves `/health` and `/refresh`. Extend `Bun.serve` routing:

- `GET /health` — unchanged liveness probe.
- `POST /refresh` — unchanged trigger.
- `GET /api/health-checks` — returns `{ latest: HealthCheckRecord[] }` matching the shape the admin UI expects.
- `GET /api/health-checks/history?service=<service>&limit=<limit>` — returns `{ service, limit, history: HealthCheckRecord[] }`.
- `GET /status` — simple HTML page showing the latest status of each service and the overall platform mode.

### 3. Update runner.ts

`apps/health-monitor/src/runner.ts` still checks SurrealDB as one of the probes (that is the point of the monitor), but it stops importing types from `db/health-checks`. Move the `HealthCheckService`, `HealthCheckStatus`, and `HealthCheckInput` types into `apps/health-monitor/src/types.ts`.

### 4. Update API consumers

`apps/api/src/routes/admin.ts` currently imports `listLatestHealthChecks` and `listHealthCheckHistoryForService` from `db/health-checks`. Replace those calls with fetches to `HEALTH_MONITOR_URL`:

- `GET /api/admin/health-checks` → `GET ${HEALTH_MONITOR_URL}/api/health-checks`
- `GET /api/admin/health-checks/history?service=...&limit=...` → `GET ${HEALTH_MONITOR_URL}/api/health-checks/history?service=...&limit=...`

`packages/db/src/platform-status.ts` currently imports `listLatestHealthChecks` from `db/health-checks`. Change it to accept an optional fetcher or call `HEALTH_MONITOR_URL` directly. To avoid breaking existing consumers, add a thin wrapper in `packages/db`:

```ts
// packages/db/src/platform-status.ts
async function fetchLatestChecks(): Promise<HealthCheckRecord[]> {
  const url = process.env.HEALTH_MONITOR_URL
  if (!url) return []
  const res = await fetch(`${url}/api/health-checks`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Health monitor returned ${res.status}`)
  const data = await res.json() as { latest: HealthCheckRecord[] }
  return data.latest
}
```

### 5. Cleanup packages/db

Remove from `packages/db`:

- `packages/db/src/health-checks.ts`
- `packages/db/test/health-checks.test.ts`
- `health_checks` references in `packages/db/src/schema-registry.ts`
- `DEFINE TABLE health_checks ...` and related indexes in `packages/db/src/seed.ts`

### 6. Docker Compose and environment

- Remove `SURREAL_URL`, `SURREAL_USER`, `SURREAL_PASS` from the `health-monitor` service environment.
- Add `HEALTH_MONITOR_DB_PATH=/data/health-monitor.sqlite`.
- Add a volume mount for `/data` (e.g., `health-monitor-data:/data`).
- Remove `depends_on: surrealdb` from `health-monitor`; keep `restate`, `workflow-runtime`, and `api` if the probes need them.

## Files changed

- `apps/health-monitor/src/types.ts` (new)
- `apps/health-monitor/src/db.ts` (new)
- `apps/health-monitor/src/runner.ts`
- `apps/health-monitor/src/index.ts`
- `apps/api/src/routes/admin.ts`
- `packages/db/src/platform-status.ts`
- `packages/db/src/health-checks.ts` (delete)
- `packages/db/test/health-checks.test.ts` (delete)
- `packages/db/src/schema-registry.ts`
- `packages/db/src/seed.ts`
- `docker-compose.yml`

## Out of scope

- Migrating existing SurrealDB `health_checks` records into SQLite. Health checks are time-series data and will repopulate automatically.
- Changing the admin UI; it will continue to consume the same API shapes from `apps/api`.
- Moving other tables out of SurrealDB.
