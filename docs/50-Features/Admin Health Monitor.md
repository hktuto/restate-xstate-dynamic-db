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

Superadmins can view the health of core platform services from the admin app. A background scheduler runs periodic checks and stores the results in SurrealDB. The same data also drives the web app's platform status, which can show a maintenance page or a degradation banner.

## Monitored services

- SurrealDB
- Restate — also verifies that the `workflow` service is registered in Restate.
- workflow-runtime
- web API

## Admin page

`/health` shows:

- Service status cards with the latest status, last check datetime, and response time.
- Clicking a card expands it inline to show the last 20 history entries (status, checked-at datetime, response time, and any error message).
- The first service’s history loads automatically on page load; other services fetch history on demand when expanded.
- A manual "Run checks now" button re-runs all checks and refreshes the histories of all expanded services.

## API

- `GET /api/health-checks` returns the latest result for each monitored service.
- `GET /api/health-checks/history?service=<service>&limit=20` returns the recent history for a single service.
- `POST /api/health-checks/run` triggers an immediate check for all services.

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
