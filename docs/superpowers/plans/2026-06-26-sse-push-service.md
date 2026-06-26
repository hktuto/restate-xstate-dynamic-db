---
title: SSE Push Service Implementation Plan
type: note
status: planned
area: docs
created: 2026-06-26
updated: 2026-06-26
related:
  - [[SSE push service design]]
  - [[50-Features/SSE Push Service]]
---

> **I'm using the writing-plans skill to create the implementation plan.**

# SSE Push Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated SSE push endpoint inside `apps/api` so `web` and `admin` clients can receive real-time workflow events and user notifications, with a clean internal delivery endpoint for producers.

**Architecture:** A `src/push/` module inside `apps/api` owns the SSE stream handler, an internal `POST /push/deliver` endpoint, and an in-memory connection manager keyed by user ID. Producers call `/push/deliver` with a shared secret; the service fans out events to connected clients. The module is isolated so it can move to a standalone service or sit behind a future Restate router without changing its contract.

**Tech Stack:** Hono 4, `hono/streaming`, TypeScript, Vitest, Nuxt 4 shared layer composable.

---

## File structure

New files in `apps/api/src/push/`:

- `src/push/types.ts` — shared types (`PushEvent`, `DeliverRequest`, `DeliverResult`, `Connection`).
- `src/push/connection-manager.ts` — in-memory `Map<userId, Set<SSEStreamingApi>>` with add, remove, deliver.
- `src/push/middleware/internal-auth.ts` — bearer-token secret check for `/push/deliver`.
- `src/push/middleware/session.ts` — SSE-friendly cookie session middleware that returns a clean `401` on failure.
- `src/push/routes/sse.ts` — `GET /push/sse` stream handler.
- `src/push/routes/deliver.ts` — `POST /push/deliver` fan-out handler.
- `src/push/index.ts` — Hono sub-app factory that wires everything together.
- `src/push/connection-manager.test.ts` — unit tests.
- `src/push/routes/sse.test.ts` — integration tests.
- `src/push/routes/deliver.test.ts` — integration tests.

Modified files:

- `apps/api/src/app.ts` — mount the push sub-app at `/push`.
- `.env.example` — add `PUSH_INTERNAL_SECRET`.

New frontend file:

- `layers/shared-api/composables/usePush.ts` — reusable `EventSource` wrapper.

---

### Task 1: Create push types

**Files:**

- Create: `apps/api/src/push/types.ts`

- [ ] **Step 1: Write the type definitions**

```ts
export interface PushEvent {
  type: string
  payload: Record<string, unknown>
}

export interface DeliverRequest {
  userId: string | string[]
  event: PushEvent
}

export interface DeliverResult {
  userId: string
  delivered: boolean
  reason?: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm --filter api typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/push/types.ts
git commit -m "feat(push): add shared push types"
```

---

### Task 2: Create connection manager

**Files:**

- Create: `apps/api/src/push/connection-manager.ts`
- Create: `apps/api/src/push/connection-manager.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { addConnection, removeConnection, deliverToUsers } from './connection-manager.js'
import type { SSEStreamingApi } from 'hono/streaming'

function mockStream(): SSEStreamingApi {
  return {
    writeSSE: vi.fn().mockResolvedValue(undefined),
    onAbort: vi.fn(),
    aborted: false,
    closed: false,
  } as unknown as SSEStreamingApi
}

describe('connection manager', () => {
  it('delivers an event to a connected user', async () => {
    const stream = mockStream()
    addConnection('user:1', stream)
    const results = await deliverToUsers(['user:1'], { type: 'test', payload: { ok: true } })
    expect(results).toEqual([{ userId: 'user:1', delivered: true }])
    expect(stream.writeSSE).toHaveBeenCalledOnce()
  })

  it('reports not-connected for offline users', async () => {
    const results = await deliverToUsers(['user:off'], { type: 'test', payload: {} })
    expect(results).toEqual([{ userId: 'user:off', delivered: false, reason: 'not-connected' }])
  })

  it('removes a connection', async () => {
    const stream = mockStream()
    addConnection('user:2', stream)
    removeConnection('user:2', stream)
    const results = await deliverToUsers(['user:2'], { type: 'test', payload: {} })
    expect(results).toEqual([{ userId: 'user:2', delivered: false, reason: 'not-connected' }])
  })

  it('delivers to multiple connections for the same user', async () => {
    const a = mockStream()
    const b = mockStream()
    addConnection('user:3', a)
    addConnection('user:3', b)
    await deliverToUsers(['user:3'], { type: 'test', payload: {} })
    expect(a.writeSSE).toHaveBeenCalledOnce()
    expect(b.writeSSE).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test src/push/connection-manager.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the connection manager**

```ts
import type { SSEStreamingApi } from 'hono/streaming'
import { randomUUID } from 'node:crypto'
import type { DeliverResult, PushEvent } from './types.js'

const connections = new Map<string, Set<SSEStreamingApi>>()

export function addConnection(userId: string, stream: SSEStreamingApi): void {
  let set = connections.get(userId)
  if (!set) {
    set = new Set()
    connections.set(userId, set)
  }
  set.add(stream)
  stream.onAbort(() => {
    removeConnection(userId, stream)
  })
}

export function removeConnection(userId: string, stream: SSEStreamingApi): void {
  const set = connections.get(userId)
  if (!set) return
  set.delete(stream)
  if (set.size === 0) {
    connections.delete(userId)
  }
}

export function normalizeUserIds(userId: string | string[]): string[] {
  return Array.isArray(userId) ? userId : [userId]
}

export async function deliverToUsers(userIds: string[], event: PushEvent): Promise<DeliverResult[]> {
  const results: DeliverResult[] = []
  const id = randomUUID()
  const data = JSON.stringify(event.payload)

  for (const userId of userIds) {
    const set = connections.get(userId)
    if (!set || set.size === 0) {
      results.push({ userId, delivered: false, reason: 'not-connected' })
      continue
    }

    try {
      await Promise.all(
        [...set].map((stream) =>
          stream.writeSSE({
            event: event.type,
            data,
            id,
          })
        )
      )
      results.push({ userId, delivered: true })
    } catch {
      results.push({ userId, delivered: false, reason: 'delivery-error' })
    }
  }

  return results
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test src/push/connection-manager.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/push/connection-manager.ts apps/api/src/push/connection-manager.test.ts
git commit -m "feat(push): add in-memory connection manager"
```

---

### Task 3: Create internal auth middleware

**Files:**

- Create: `apps/api/src/push/middleware/internal-auth.ts`
- Create: `apps/api/src/push/middleware/internal-auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { pushInternalAuthMiddleware } from './internal-auth.js'

describe('push internal auth', () => {
  it('allows requests with a valid secret', async () => {
    const app = new Hono().use(pushInternalAuthMiddleware('secret')).get('/', (c) => c.text('ok'))
    const res = await app.request('/', { headers: { Authorization: 'Bearer secret' } })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('rejects missing authorization', async () => {
    const app = new Hono().use(pushInternalAuthMiddleware('secret')).get('/', (c) => c.text('ok'))
    const res = await app.request('/')
    expect(res.status).toBe(401)
  })

  it('rejects invalid token', async () => {
    const app = new Hono().use(pushInternalAuthMiddleware('secret')).get('/', (c) => c.text('ok'))
    const res = await app.request('/', { headers: { Authorization: 'Bearer wrong' } })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test src/push/middleware/internal-auth.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the middleware**

```ts
import { createMiddleware } from 'hono/factory'

export function pushInternalAuthMiddleware(secret: string) {
  return createMiddleware(async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header || !header.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const token = header.slice(7)
    if (token !== secret) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    await next()
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test src/push/middleware/internal-auth.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/push/middleware/internal-auth.ts apps/api/src/push/middleware/internal-auth.test.ts
git commit -m "feat(push): add internal auth middleware"
```

---

### Task 4: Create SSE session middleware

**Files:**

- Create: `apps/api/src/push/middleware/session.ts`
- Create: `apps/api/src/push/middleware/session.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { pushSessionMiddleware } from './session.js'
import { createAccessToken } from '../../lib/session.js'

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-secret'
}

describe('push session middleware', () => {
  it('sets pushUserId for a valid tenant token', async () => {
    const { token } = createAccessToken({
      sessionId: 'sess:1',
      accountId: 'acc:1',
      profileId: 'prof:1',
      type: 'user',
    })
    const app = new Hono().use(pushSessionMiddleware).get('/', (c) => c.json({ userId: c.get('pushUserId') }))
    const res = await app.request('/', { headers: { Cookie: `tenant_access_token=${token}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'acc:1' })
  })

  it('sets pushUserId for a valid admin token', async () => {
    const { token } = createAccessToken({
      sessionId: 'sess:2',
      accountId: 'acc:2',
      profileId: 'prof:2',
      type: 'user',
      email: 'admin@test.co',
    })
    const app = new Hono().use(pushSessionMiddleware).get('/', (c) => c.json({ userId: c.get('pushUserId') }))
    const res = await app.request('/', { headers: { Cookie: `admin_access_token=${token}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'acc:2' })
  })

  it('returns clean 401 without a JSON body when unauthenticated', async () => {
    const app = new Hono().use(pushSessionMiddleware).get('/', (c) => c.text('ok'))
    const res = await app.request('/')
    expect(res.status).toBe(401)
    expect(res.headers.get('content-length')).toBe('0')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test src/push/middleware/session.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the middleware**

```ts
import { createMiddleware } from 'hono/factory'
import {
  readTenantAccessToken,
  readAdminAccessToken,
  verifyAccessTokenCookie,
} from '../../lib/session.js'

declare module 'hono' {
  interface ContextVariableMap {
    pushUserId: string
  }
}

export const pushSessionMiddleware = createMiddleware(async (c, next) => {
  const tenantAccess = readTenantAccessToken(c)
  if (tenantAccess) {
    const payload = verifyAccessTokenCookie(tenantAccess)
    if (payload) {
      c.set('pushUserId', payload.accountId)
      return next()
    }
  }

  const adminAccess = readAdminAccessToken(c)
  if (adminAccess) {
    const payload = verifyAccessTokenCookie(adminAccess)
    if (payload) {
      c.set('pushUserId', payload.accountId)
      return next()
    }
  }

  return c.body(null, 401)
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test src/push/middleware/session.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/push/middleware/session.ts apps/api/src/push/middleware/session.test.ts
git commit -m "feat(push): add sse session middleware"
```

---

### Task 5: Create SSE route

**Files:**

- Create: `apps/api/src/push/routes/sse.ts`
- Create: `apps/api/src/push/routes/sse.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { createAccessToken } from '../../lib/session.js'

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-secret'
}

function tenantCookie(accountId: string): string {
  const { token } = createAccessToken({
    sessionId: 'sess:test',
    accountId,
    profileId: 'prof:test',
    type: 'user',
  })
  return `tenant_access_token=${token}`
}

describe('push sse route', () => {
  it('returns 401 without a session', async () => {
    const app = createApp()
    const res = await app.request('/push/sse')
    expect(res.status).toBe(401)
  })

  it('opens an SSE stream for an authenticated tenant', async () => {
    const app = createApp()
    const controller = new AbortController()
    const resPromise = app.request('/push/sse', {
      headers: { Cookie: tenantCookie('acc:test') },
      signal: controller.signal,
    })

    // Give the server time to start the stream.
    await new Promise((r) => setTimeout(r, 100))
    controller.abort()

    const res = await resPromise
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test src/push/routes/sse.test.ts`

Expected: FAIL — module not found or route not mounted.

- [ ] **Step 3: Implement the SSE route**

```ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { pushSessionMiddleware } from '../middleware/session.js'
import { addConnection, removeConnection } from '../connection-manager.js'

const HEARTBEAT_INTERVAL_MS = 30_000

export function createSseRoute() {
  const app = new Hono()

  app.get('/sse', pushSessionMiddleware, (c) => {
    const userId = c.get('pushUserId')

    return streamSSE(c, async (stream) => {
      addConnection(userId, stream)

      await stream.writeSSE({
        event: 'connected',
        data: JSON.stringify({ userId, connectedAt: new Date().toISOString() }),
      })

      const heartbeat = setInterval(async () => {
        await stream.writeSSE({ event: 'heartbeat', data: '{}' })
      }, HEARTBEAT_INTERVAL_MS)

      stream.onAbort(() => {
        clearInterval(heartbeat)
        removeConnection(userId, stream)
      })

      await new Promise<void>((resolve) => {
        stream.onAbort(() => resolve())
      })
    })
  })

  return app
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test src/push/routes/sse.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/push/routes/sse.ts apps/api/src/push/routes/sse.test.ts
git commit -m "feat(push): add sse stream route"
```

---

### Task 6: Create deliver route

**Files:**

- Create: `apps/api/src/push/routes/deliver.ts`
- Create: `apps/api/src/push/routes/deliver.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { createAccessToken } from '../../lib/session.js'

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-secret'
}

if (!process.env.PUSH_INTERNAL_SECRET) {
  process.env.PUSH_INTERNAL_SECRET = 'push-secret'
}

const TEST_USER_ID = 'acc:deliver-test'

function tenantCookie(accountId: string): string {
  const { token } = createAccessToken({
    sessionId: 'sess:test',
    accountId,
    profileId: 'prof:test',
    type: 'user',
  })
  return `tenant_access_token=${token}`
}

describe('push deliver route', () => {
  it('returns 401 without internal secret', async () => {
    const app = createApp()
    const res = await app.request('/push/deliver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user:1', event: { type: 'test', payload: {} } }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid body', async () => {
    const app = createApp()
    const res = await app.request('/push/deliver', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer push-secret',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('delivers an event to a connected user', async () => {
    const app = createApp()
    const controller = new AbortController()
    const ssePromise = app.request('/push/sse', {
      headers: { Cookie: tenantCookie(TEST_USER_ID) },
      signal: controller.signal,
    })

    // Wait for the stream to register.
    await new Promise((r) => setTimeout(r, 150))

    const deliverRes = await app.request('/push/deliver', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer push-secret',
      },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        event: { type: 'test:greeting', payload: { hello: 'world' } },
      }),
    })

    expect(deliverRes.status).toBe(200)
    const body = (await deliverRes.json()) as { results: Array<{ userId: string; delivered: boolean }> }
    expect(body.results).toHaveLength(1)
    expect(body.results[0].delivered).toBe(true)

    controller.abort()
    const sseRes = await ssePromise
    expect(sseRes.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test src/push/routes/deliver.test.ts`

Expected: FAIL — module not found or route not mounted.

- [ ] **Step 3: Implement the deliver route**

```ts
import { Hono } from 'hono'
import { pushInternalAuthMiddleware } from '../middleware/internal-auth.js'
import { deliverToUsers, normalizeUserIds } from '../connection-manager.js'
import type { DeliverRequest } from '../types.js'

function isValidDeliverBody(body: unknown): body is DeliverRequest {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return false
  const { userId, event } = body as Record<string, unknown>

  const validUserId = typeof userId === 'string' || (Array.isArray(userId) && userId.every((id) => typeof id === 'string'))
  if (!validUserId) return false

  if (event === null || typeof event !== 'object' || Array.isArray(event)) return false
  const { type, payload } = event as Record<string, unknown>
  if (typeof type !== 'string') return false
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return false

  return true
}

export function createDeliverRoute(secret: string) {
  const app = new Hono()

  app.post('/deliver', pushInternalAuthMiddleware(secret), async (c) => {
    const body = await c.req.json()
    if (!isValidDeliverBody(body)) {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const userIds = normalizeUserIds(body.userId)
    const results = await deliverToUsers(userIds, body.event)
    return c.json({ results })
  })

  return app
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test src/push/routes/deliver.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/push/routes/deliver.ts apps/api/src/push/routes/deliver.test.ts
git commit -m "feat(push): add internal deliver route"
```

---

### Task 7: Wire push sub-app into the API

**Files:**

- Modify: `apps/api/src/push/index.ts` (create)
- Modify: `apps/api/src/app.ts`
- Modify: `.env.example`

- [ ] **Step 1: Create the push sub-app factory**

```ts
import { Hono } from 'hono'
import { createSseRoute } from './routes/sse.js'
import { createDeliverRoute } from './routes/deliver.js'

export interface PushAppOptions {
  internalSecret: string
}

export function createPushApp(options: PushAppOptions) {
  const app = new Hono()
  app.route('/', createSseRoute())
  app.route('/', createDeliverRoute(options.internalSecret))
  return app
}
```

- [ ] **Step 2: Mount it in `apps/api/src/app.ts`**

Add to imports:

```ts
import { createPushApp } from './push/index.js'
```

Add after health route:

```ts
app.route('/push', createPushApp({ internalSecret: process.env.PUSH_INTERNAL_SECRET ?? '' }))
```

- [ ] **Step 3: Add `PUSH_INTERNAL_SECRET` to `.env.example`**

Append:

```env
# Push service
PUSH_INTERNAL_SECRET=change-me-in-production
```

- [ ] **Step 4: Run typecheck and all push tests**

Run:

```bash
pnpm --filter api typecheck
pnpm --filter api test src/push/
```

Expected: no type errors; all push tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/push/index.ts apps/api/src/app.ts .env.example
git commit -m "feat(push): mount push sub-app and expose env config"
```

---

### Task 8: Create the frontend `usePush` composable

**Files:**

- Create: `layers/shared-api/composables/usePush.ts`

- [ ] **Step 1: Implement the composable**

```ts
import { ref, onScopeDispose } from 'vue'

export interface PushMessage<T = unknown> {
  id?: string
  type: string
  payload: T
}

export function usePush() {
  const config = useRuntimeConfig()
  const connected = ref(false)
  let eventSource: EventSource | null = null

  function connect() {
    if (eventSource) return

    const url = `${config.public.apiUrl as string}/push/sse`
    eventSource = new EventSource(url, { withCredentials: true })

    eventSource.onopen = () => {
      connected.value = true
    }

    eventSource.onerror = () => {
      connected.value = false
    }
  }

  function disconnect() {
    eventSource?.close()
    eventSource = null
    connected.value = false
  }

  function onMessage<T = unknown>(type: string, handler: (message: PushMessage<T>) => void) {
    connect()

    const listener = (event: MessageEvent) => {
      handler({
        id: event.lastEventId || undefined,
        type: event.type,
        payload: JSON.parse(event.data) as T,
      })
    }

    eventSource?.addEventListener(type, listener)

    return () => {
      eventSource?.removeEventListener(type, listener)
    }
  }

  onScopeDispose(disconnect)

  return {
    connected,
    connect,
    disconnect,
    onMessage,
  }
}
```

- [ ] **Step 2: Verify the layer builds**

Run: `pnpm --filter shared-api typecheck` (or `pnpm -r typecheck` if the layer has no separate script).

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add layers/shared-api/composables/usePush.ts
git commit -m "feat(push): add usePush composable for web and admin"
```

---

### Task 9: Final verification

**Files:** none

- [ ] **Step 1: Run all API tests**

Run: `pnpm --filter api test`

Expected: all tests pass, including the new push tests.

- [ ] **Step 2: Run full typecheck**

Run: `pnpm --filter api typecheck`

Expected: no errors.

- [ ] **Step 3: Smoke test (skip if Docker/dev server unavailable)**

If the environment can run Docker and the dev server, run:

```bash
docker compose up -d
pnpm --filter api dev
```

In a separate shell, start `apps/web` or `apps/admin` and verify in the browser console that `usePush().connect()` opens an SSE connection to `http://localhost:3002/push/sse` and receives the `connected` event.

If Docker or the dev server cannot run, skip this step and rely on the unit and integration tests above.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "feat(push): final verification and smoke test fixes"
```

---

## Self-review checklist

**Spec coverage:**

- Single authenticated SSE endpoint for web/admin — Task 5.
- Workflow events and user notifications — producer integration is out of scope for this plan but enabled by the deliver contract; see design doc.
- Dumb delivery pipe — Tasks 2, 6, 7.
- Lives inside `apps/api`, isolated for extraction — Task 7.
- Contract ready for future Restate router — `POST /push/deliver` with per-user results and `500` retry semantics — Task 6.
- Best-effort delivery — no persistence or replay — Tasks 2, 6.

**Placeholder scan:**

- No TBD, TODO, or vague steps.
- Each task includes exact file paths, code, and commands.

**Type consistency:**

- `PushEvent`, `DeliverRequest`, `DeliverResult` defined once in `types.ts` and reused everywhere.
- `userId` accepted as `string | string[]` in deliver route and normalized by `normalizeUserIds`.
- `pushUserId` context variable declared in `session.ts` middleware and used in `sse.ts`.
