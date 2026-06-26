---
title: "SSE push service design"
type: note
status: done
area: architecture
app:
  - api
  - web
  - admin
created: 2026-06-26
updated: 2026-06-26
related:
  - [[30-Apps/API/Overview]]
  - [[30-Apps/Web/Overview]]
  - [[30-Apps/Admin/Overview]]
  - [[50-Features/Workflow Engine]]
  - [[50-Features/User Tasks]]
  - [[50-Features/SSE Push Service]]
  - [[20-Architecture/Decision Log/ADR-002 Restate for workflow runtime]]
---

# SSE push service design

Add Server-Sent Events (SSE) push capabilities to the monorepo so `apps/web` and `apps/admin` can receive real-time workflow events and user notifications from the backend. The first phase lives inside `apps/api` as a `src/push/` module, with a clear separation between the dumb delivery pipe and the routing/decision layer so a future Restate service can take over routing and retries without changing the SSE contract.

## Context

- `apps/web` and `apps/admin` are Nuxt 4 SPAs that currently poll or fetch state on demand.
- `apps/api` is a Hono 4 service that already owns session auth, CORS, and business routes.
- `apps/workflow-runtime` runs durable XState workflows on Restate and emits lifecycle events.
- There is currently no client push infrastructure (no SSE, WebSocket, or server-streaming endpoint).
- The session auth system uses HMAC-signed access/refresh token cookies, shared via `packages/shared/src/session.ts`.

## Goals

1. Provide a single authenticated SSE endpoint for both `web` and `admin` clients.
2. Deliver workflow events and user notifications to connected clients in real time.
3. Keep the SSE service as a dumb delivery pipe; producers decide who receives what.
4. Start inside `apps/api` to minimize dev-phase friction, but keep the code isolated so it can move to a standalone service later.
5. Design the delivery contract so a future Restate push-router can own routing, retries, and persistence.
6. Support best-effort delivery only for this phase; no message history or replay.

## Non-goals

- Guaranteed delivery or offline message persistence in this phase.
- WebSocket support.
- Multi-instance horizontal scaling of the SSE service.
- Restate push-router implementation.

## Design

### 1. Architecture & boundaries

```
┌─────────────────┐     HTTP POST      ┌─────────────────────────────┐
│  workflow-      │───────────────────▶│  apps/api/src/push/         │
│  runtime        │    /push/deliver   │  • connection manager       │
│                 │                    │  • SSE stream handler       │
└─────────────────┘                    │  • internal deliver handler │
                                       └─────────────────────────────┘
┌─────────────────┐     HTTP POST            ▲            │ SSE
│  apps/api       │──────────────────────────┘            │ event-stream
│  (user tasks)   │                                       ▼
└─────────────────┘                        ┌─────────────────────────┐
                                           │  web / admin clients    │
                                           └─────────────────────────┘
```

In this phase:

- **SSE delivery pipe** lives in `apps/api/src/push/`.
- **Producers** (`apps/api`, `apps/workflow-runtime`) call `/push/deliver` directly.
- **Clients** open `GET /push/sse` with credentials and receive events.

Future phase:

- Producers send domain events to a **Restate push-router** instead of calling SSE directly.
- The router computes recipient user IDs, calls `/push/deliver`, and retries on transient failures.
- The SSE delivery contract remains unchanged.

### 2. Components & files

Inside `apps/api`:

- `src/push/index.ts` — factory that creates the push Hono sub-app and mounts routes.
- `src/push/routes/sse.ts` — `GET /push/sse`. Authenticates via session cookies, registers the stream, sends `connected` and periodic `heartbeat` events.
- `src/push/routes/deliver.ts` — `POST /push/deliver`. Validates internal secret, fans out events to connected users, returns per-user delivery status.
- `src/push/connection-manager.ts` — in-memory `Map<userId, Set<Connection>>` with `add`, `remove`, and `deliver`.
- `src/push/middleware/internal-auth.ts` — shared secret check for the deliver endpoint.
- `src/push/types.ts` — `PushEvent`, `DeliverRequest`, `DeliverResult`, `Connection` types.
- `src/app.ts` — mounts the push sub-app at `/push`.

Frontend:

- `layers/shared-api/composables/usePush.ts` — reusable `EventSource` wrapper with reconnect and typed message parsing.

Producer integration (dev phase):

- `apps/api` routes that create user tasks call the deliver helper.
- `apps/workflow-runtime` handlers call the deliver endpoint for interesting lifecycle transitions.

### 3. Data flow & event contract

#### Client handshake

```http
GET /push/sse HTTP/1.1
Cookie: tenant_access_token=...
Accept: text/event-stream
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: connected
data: {"userId":"user:123","connectedAt":"2026-06-26T09:37:45.312Z"}

event: heartbeat
data: {}
```

#### Producer delivery

```http
POST /push/deliver HTTP/1.1
Authorization: Bearer ${PUSH_INTERNAL_SECRET}
Content-Type: application/json

{
  "userId": "user:123",
  "event": {
    "type": "workflow:step:completed",
    "payload": {
      "workflowInstanceId": "wi:abc",
      "stepId": "validate"
    }
  }
}
```

`userId` may also be an array of user IDs:

```json
{
  "userId": ["user:123", "user:456"],
  "event": { "type": "user-task:assigned", "payload": { "taskId": "task:789" } }
}
```

#### Delivery response

Per-user status:

```json
{
  "results": [
    { "userId": "user:123", "delivered": true },
    { "userId": "user:456", "delivered": false, "reason": "not-connected" }
  ]
}
```

Status codes:

- `200` — request processed (individual results may show `delivered: false`).
- `400` — invalid body.
- `401` — missing or invalid internal secret.
- `500` — transient failure (e.g., stream write error); callers should retry.

#### Event stream format

```
id: <uuid>
event: <event.type>
data: <JSON.stringify(event.payload)>

```

The `id` field enables future `Last-Event-ID` replay without changing the format.

### 4. Error handling & edge cases

- **Client disconnect:** Remove the connection from the manager. No retry; delivery to that user stops until reconnect.
- **Duplicate tabs:** All connections for a user are kept in a `Set`; events are broadcast to each.
- **Auth failure on SSE:** Return a clean HTTP `401` with no JSON body. Some `EventSource` polyfills choke on JSON during handshake.
- **Producer auth failure:** Return `401` on `/push/deliver`.
- **Invalid request body:** Return `400`.
- **Transient stream write failure:** Return `500` for that user so the producer/future router can retry.
- **Heartbeat:** Send `event: heartbeat` every 30 seconds. If the client is gone, the write fails and triggers cleanup.
- **Offline users:** Return `delivered: false, reason: "not-connected"`. Messages are not persisted.

### 5. Testing & observability

Tests:

- Unit tests for `connection-manager.ts`:
  - add/remove connections
  - deliver to connected user
  - deliver to offline user
  - deliver to multiple connections for one user
- Integration tests for `/push/deliver`:
  - valid secret delivers event
  - invalid secret returns `401`
  - bad body returns `400`
- Integration tests for `/push/sse`:
  - valid session opens stream and receives `connected`
  - missing session returns `401`
  - connected client receives an event after a deliver call

Observability:

- Log connect/disconnect at `debug` level.
- Log every `/push/deliver` call at `info` with summary counts.
- Counters: `push_connections_total`, `push_delivered_total`, `push_not_connected_total`, `push_delivery_errors_total`.

## Files changed

- `apps/api/src/push/index.ts` (new)
- `apps/api/src/push/routes/sse.ts` (new)
- `apps/api/src/push/routes/deliver.ts` (new)
- `apps/api/src/push/connection-manager.ts` (new)
- `apps/api/src/push/middleware/internal-auth.ts` (new)
- `apps/api/src/push/types.ts` (new)
- `apps/api/src/app.ts` (mount push routes)
- `apps/api/package.json` (add test scripts if needed)
- `layers/shared-api/composables/usePush.ts` (new)
- `.env.example` (add `PUSH_INTERNAL_SECRET`)

## Out of scope

- Standalone `apps/push` service.
- Redis or other external message broker.
- Restate push-router.
- Message persistence, inbox, or replay.
- WebSocket transport.
- Push notifications to mobile or browser push APIs.

## Future work

- Extract `apps/api/src/push/` into a standalone `apps/push` Hono service when horizontal scaling or isolation becomes necessary.
- Introduce a Restate push-router that owns recipient resolution, retries, and idempotency.
- Add Redis Pub/Sub or SurrealDB live queries if the standalone push service needs to fan out across multiple instances.
- Add `Last-Event-ID` replay once a message store is implemented.
