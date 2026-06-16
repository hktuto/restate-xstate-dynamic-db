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

- **surrealdb** — Database on port `8000`.
- **restate** — Durable runtime on ports `8080` and `9070`.
- **health-monitor** — Standalone health-check service, built from `apps/health-monitor/Dockerfile`.

## Volumes

- SurrealDB data is persisted in `./data/surreal`.

## Environment overrides for health-monitor

The `health-monitor` service loads `.env` and then overrides the URLs so it can reach the other Compose services:

| Variable | Compose value |
|----------|---------------|
| Variable | Compose value |
|----------|---------------|
| `SURREAL_URL` | `http://surrealdb:8000/rpc` |
| `RESTATE_META_URL` | `http://restate:9070` |
| `WORKFLOW_RUNTIME_URL` | `http://host.docker.internal:9080` |
| `WEB_API_URL` | `http://host.docker.internal:3000` |
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

# Reset database (destructive)
docker compose down -v
rm -rf data/surreal
```

## Related

- [[SurrealDB Maintenance]]
- [[Restate Operations]]
