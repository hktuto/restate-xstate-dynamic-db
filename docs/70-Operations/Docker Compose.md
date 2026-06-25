---
title: Docker Compose
type: runbook
status: done
area: ops
created: 2026-06-14
updated: 2026-06-25
related:
  - [[SurrealDB Maintenance]]
  - [[Restate Operations]]
  - [[30-Apps/Health Monitor/Overview]]
---

# Docker Compose

## Services

- **surrealdb** — Development database on port `8000`, backed by RocksDB.
- **surrealdb-test** — Isolated test database on port `8001`. The test suite loads `.env.test`, which points `SURREAL_URL` at this instance.
- **restate** — Durable runtime on ports `8080` and `9070`.
- **workflow-runtime** — Restate service on port `9080` (HTTP/2) with health check on port `9081`.
- **health-monitor** — Standalone health-check service, built from `apps/health-monitor/Dockerfile`. Exposes an internal HTTP server on port `3010` for refresh requests and a `/health` probe used by Docker Compose.
- **restate-register** — One-shot registration of the workflow-runtime deployment.

## Volumes

- `surreal-data` — Named Docker volume for SurrealDB/RocksDB data.
- `surreal-test-data` — Named Docker volume for the test SurrealDB instance.
- `restate-data` — Named Docker volume for Restate state.

## Environment overrides for health-monitor

The `health-monitor` service loads `.env` and then overrides the URLs so it can reach the other Compose services:

| Variable | Compose value |
|----------|---------------|
| `SURREAL_URL` | `ws://surrealdb:8000/rpc` |
| `RESTATE_META_URL` | `http://restate:9070` |
| `WORKFLOW_RUNTIME_URL` | `http://host.docker.internal:9080` |
| `API_URL` | `http://host.docker.internal:3002` |
| `HEALTH_MONITOR_PORT` | `3010` |
| `HEALTH_CHECK_INTERVAL_MS` | `1800000` (30 min) |
| `HEALTH_CHECK_RETENTION_DAYS` | `365` |

## Service dependencies

- `api` waits for `health-monitor` to be healthy before starting, because the API triggers a health refresh on startup via `HEALTH_MONITOR_URL=http://health-monitor:3010`.
- `health-monitor` exposes port `3010` bound to `127.0.0.1` on the host and provides a Docker `healthcheck` on `GET /health`.

## Common operations

```bash
# Start infrastructure and health monitor
docker compose up -d

# Start only infrastructure (run health monitor via pnpm instead)
docker compose up -d surrealdb restate

# Start the test SurrealDB instance (needed for `pnpm --filter db test` etc.)
docker compose up -d surrealdb-test

# Stop
docker compose down

# Reset everything (destructive)
docker compose down -v

# If you keep Restate's volume but recreate the container,
# set RESTATE_NODE_NAME to the existing node name to avoid RT0002.
# Otherwise wipe the volume with `docker compose down -v`.
```

## Related

- [[SurrealDB Maintenance]]
- [[Restate Operations]]
