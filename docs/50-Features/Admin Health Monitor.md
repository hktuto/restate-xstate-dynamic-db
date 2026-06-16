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
  - [[30-Apps/Health Monitor/Overview]]
  - [[Workflow Runtime]]
  - [[40-Packages/db]]
---

# Admin Health Monitor

## Overview

Superadmins can view the health of core platform services from the admin app. A standalone health-monitor service runs periodic checks and stores the results in SurrealDB. The same data also drives the web app's platform status, which can show a maintenance page or a degradation banner.

## Monitored services

- SurrealDB
- Restate — also verifies that the `workflow` service is registered in Restate.
- workflow-runtime
- web API

## Admin page

`/health` shows:

- Service status cards with the latest status, last check datetime, and response time.
- Clicking a card expands it inline to show the last 20 history entries (status, checked-at datetime, response time, and any error message).
- Service history is fetched on demand when a card is expanded.
- A **Refresh** button reloads the latest health-check data.

## API

- `GET /api/health-checks` returns the latest result for each monitored service.
- `GET /api/health-checks/history?service=<service>&limit=20` returns the recent history for a single service.

## Configuration

The standalone health-monitor service is configured via `.env.example`:

- `RESTATE_META_URL`
- `WORKFLOW_RUNTIME_URL`
- `WEB_API_URL`
- `HEALTH_CHECK_INTERVAL_MS`
- `HEALTH_CHECK_RETENTION_DAYS`

The admin app only reads the existing health-check records through `GET /api/health-checks` and `GET /api/health-checks/history`.

## Architecture

The health-check runner lives in the standalone `apps/health-monitor` service (`apps/health-monitor/src/runner.ts`), which writes results to SurrealDB. The admin app only reads those records, so it remains stateless and can be scaled behind a load balancer.

## Related

- [[30-Apps/Admin App/Overview|Admin App]]
- [[Workflow Runtime|Workflow Runtime architecture]]
- [[40-Packages/db|db package]]
