---
title: SSE Push Service
type: feature
status: done
area: architecture
app:
  - api
  - web
  - admin
created: 2026-06-26
updated: 2026-06-26
related:
  - [[Workflow Engine]]
  - [[User Tasks]]
  - [[30-Apps/API/Overview]]
  - [[30-Apps/Web/Overview]]
  - [[30-Apps/Admin/Overview]]
  - [[20-Architecture/Decision Log/ADR-002 Restate for workflow runtime]]
  - [[SSE push service design]]
---

# SSE Push Service

Real-time push infrastructure that streams workflow events and user notifications to connected `web` and `admin` clients using Server-Sent Events (SSE).

## Overview

The SSE push service adds a lightweight delivery pipe to the monorepo. Clients open a single authenticated SSE connection to the API, and backend producers (API routes, workflow runtime) publish events targeted at specific users. The first phase is best-effort and lives inside `apps/api` so it can be iterated quickly; the code is isolated so it can later move to a standalone service or be fronted by a Restate push-router that owns routing, retries, and persistence.

## Requirements

- Provide one authenticated SSE endpoint for both `web` and `admin` clients.
- Deliver workflow lifecycle events and user-task notifications to connected clients.
- Keep the SSE layer a dumb delivery pipe; producers or a future router decide who receives what.
- Authenticate clients via the existing session cookie mechanism.
- Authenticate producers with a shared internal secret.
- Return per-user delivery status so callers know whether a user was connected.
- Design the contract so a future Restate service can own routing and retries without changing SSE.

## Design

See the full design spec: [[SSE push service design]].

High-level flow:

1. Client opens `GET /push/sse` with session credentials.
2. Server verifies the session, registers the connection under the user's ID, and sends a `connected` event.
3. Producers call `POST /push/deliver` with a user ID (or array) and an event payload.
4. Server fans out the event to all connections for those users and returns per-user results.

## Out of scope

- Guaranteed delivery or offline replay in the first phase.
- WebSocket transport.
- Multi-instance scaling.
- Restate push-router (planned as future work).

## Related

- [[Workflow Engine]]
- [[User Tasks]]
- [[30-Apps/API/Overview|API App]]
- [[30-Apps/Web/Overview|Web App]]
- [[30-Apps/Admin/Overview|Admin App]]
