---
title: Environment Setup
type: runbook
status: done
area: docs
created: 2026-06-14
updated: 2026-06-25
related:
  - [[Getting Started]]
  - [[Docker Compose]]
---

# Environment Setup

## Required environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SURREAL_URL` | `ws://localhost:8000/rpc` | SurrealDB connection URL. |
| `SURREAL_USER` | `root` | SurrealDB root user. |
| `SURREAL_PASS` | `root` | SurrealDB root password. |
| `RESTATE_INGRESS` | `http://localhost:8080` | Restate ingress URL. |
| `SESSION_SECRET` | — | Required. Used to sign `tenant_session` and `admin_session` cookies. |
| `NITRO_API_URL` | — | Optional external API URL. |
| `SURREALDB_POOL_MAX` | `20` | Max pooled SurrealDB connections across all namespaces. |
| `SURREALDB_POOL_IDLE_TIMEOUT_MS` | `30000` | Idle connection eviction timeout. |
| `SURREALDB_POOL_ACQUIRE_TIMEOUT_MS` | `10000` | Max wait for a pooled connection. |
| `RESTATE_NODE_NAME` | — | Set when reusing an existing Restate data volume to avoid node-name mismatch (`RT0002`). |
| `HEALTH_MONITOR_URL` | `http://localhost:3010` | URL the API uses to reach the health-monitor service. |
| `HEALTH_MONITOR_PORT` | `3010` | Port the health-monitor HTTP server binds to. |

## Test environment

The root `.env.test` file supplies values used by the test suite, including a dedicated `SURREAL_URL` pointing at the `surrealdb-test` Docker service on port `8001`. The shared Vitest base config loads this file before any test module is imported.

## API environment loading

The API service (`apps/api`) does not use per-app `.env` files. Its `dev` and `start` scripts load the root `.env` file with Node's `--env-file` flag:

```bash
# Inside apps/package.json
tsx --env-file ../../.env src/index.ts
```

`SESSION_SECRET` must be defined in the root `.env`. If it is missing, the API throws `Error: SESSION_SECRET is required` on startup.

## Per-app env files

The Nuxt apps (`apps/web`, `apps/admin`) load `.env` or `.env.local` files via Nuxt / Nitro conventions.

## Related

- [[Getting Started]]
- [[Docker Compose]]
