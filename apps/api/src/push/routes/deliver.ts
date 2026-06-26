import { Hono } from 'hono'
import { pushInternalAuthMiddleware } from '../middleware/internal-auth.js'
import { deliverToUsers, normalizeUserIds } from '../connection-manager.js'
import type { DeliverRequest } from '../types.js'

const VALID_EVENT_TYPE = /^[a-zA-Z0-9:._-]+$/

function isValidDeliverBody(body: unknown): body is DeliverRequest {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return false
  const { userId, event } = body as Record<string, unknown>

  const validUserId = typeof userId === 'string' || (Array.isArray(userId) && userId.every((id) => typeof id === 'string'))
  if (!validUserId) return false

  if (event === null || typeof event !== 'object' || Array.isArray(event)) return false
  const { type, payload } = event as Record<string, unknown>
  if (typeof type !== 'string' || !VALID_EVENT_TYPE.test(type)) return false
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return false

  return true
}

export function createDeliverRoute(secret: string) {
  const app = new Hono()

  app.post('/deliver', pushInternalAuthMiddleware(secret), async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    if (!isValidDeliverBody(body)) {
      return c.json({ error: 'Invalid request body' }, 400)
    }

    const userIds = normalizeUserIds(body.userId)
    const results = await deliverToUsers(userIds, body.event)
    console.info(`[push] deliver request results=${JSON.stringify({ results })}`)
    return c.json({ results })
  })

  return app
}
