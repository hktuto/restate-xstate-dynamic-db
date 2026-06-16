---
title: Admin Health Monitor
type: feature
status: planned
area: workflow
created: 2026-06-15
updated: 2026-06-16
related:
  - [[30-Apps/Admin App/Overview]]
  - [[Workflow Runtime]]
  - [[40-Packages/db]]
---

# Admin Health Monitor

## Overview

Superadmins can view the health of core platform services from the admin app. A background scheduler runs periodic checks and stores the results in SurrealDB.

## Monitored services

- SurrealDB
- Restate
- workflow-runtime
- web API

## Admin page

`/health` shows:

- Current status cards for each service.
- Recent check history table.
- A manual "Run checks now" button.

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
