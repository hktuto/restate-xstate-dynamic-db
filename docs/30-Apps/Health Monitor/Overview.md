---
title: Health Monitor App Overview
type: app
status: done
area: ops
created: 2026-06-15
updated: 2026-06-16
app:
  - health-monitor
related:
  - [[50-Features/Admin Health Monitor]]
  - [[30-Apps/Admin App/Overview]]
  - [[30-Apps/Web App/Overview]]
  - [[40-Packages/db]]
---

# Health Monitor App Overview

## Purpose

A lightweight standalone service that periodically checks the health of core platform services and persists the results to SurrealDB.

## Key behaviors

- Runs on Bun directly from TypeScript source with no build step.
- Uses a configurable interval (`HEALTH_CHECK_INTERVAL_MS`, default 60s; set to `0` to disable).
- Prunes health-check records older than `HEALTH_CHECK_RETENTION_DAYS` (default 365 days).
- Gracefully shuts down on `SIGTERM`/`SIGINT`, waiting for any in-flight tick to finish.
- Writes results via the `db` package so the admin and web apps can read them.

## Monitored services

- SurrealDB
- Restate — also verifies that the `workflow` service is registered.
- workflow-runtime
- web-api

## Configuration

See `.env.example` for required env vars.

## Commands

Run via Docker Compose (recommended):

```bash
docker compose up -d
```

## Related

- [[50-Features/Admin Health Monitor]]
- [[30-Apps/Admin App/Overview|Admin App]]
- [[30-Apps/Web App/Overview|Web App]]
- [[40-Packages/db|db package]]
