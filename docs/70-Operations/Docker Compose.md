---
title: Docker Compose
type: runbook
status: done
area: ops
created: 2026-06-14
updated: 2026-06-15
related:
  - [[SurrealDB Maintenance]]
  - [[Restate Operations]]
  - [[30-Apps/Health Monitor/Overview]]
---

# Docker Compose

## Services

- **surrealdb** — Database on port `8000`, backed by RocksDB.
- **restate** — Durable runtime on ports `8080` and `9070`.
- **workflow-runtime** — Restate service on port `9080` (HTTP/2) with health check on port `9081`.
- **health-monitor** — Standalone health-check service, built from `apps/health-monitor/Dockerfile`.
- **restate-register** — One-shot registration of the workflow-runtime deployment.

## Volumes

- `surreal-data` — Named Docker volume for SurrealDB/RocksDB data.
- `restate-data` — Named Docker volume for Restate state.

## Environment overrides for health-monitor

The `health-monitor` service loads `.env` and then overrides the URLs so it can reach the other Compose services:

| Variable | Compose value |
|----------|---------------|
| Variable | Compose value |
|----------|---------------|
| `SURREAL_URL` | `ws://surrealdb:8000/rpc` |
| `RESTATE_META_URL` | `http://restate:9070` |
| `WORKFLOW_RUNTIME_URL` | `http://host.docker.internal:9080` |
| `API_URL` | `http://host.docker.internal:3002` |
| `HEALTH_CHECK_INTERVAL_MS` | `1800000` (30 min) |
| `HEALTH_CHECK_RETENTION_DAYS` | `365` |

## Common operations

```bash
# Start infrastructure and health monitor
docker compose up -d

# Start only infrastructure (run health monitor via pnpm instead)
docker compose up -d surrealdb restate

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
