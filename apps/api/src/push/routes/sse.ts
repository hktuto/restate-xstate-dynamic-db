import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { pushSessionMiddleware } from '../middleware/session.js'
import { addConnection } from '../connection-manager.js'

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

      const heartbeat = setInterval(() => {
        stream.writeSSE({ event: 'heartbeat', data: '{}' }).catch(() => {
          // Client disconnected; onAbort will clear the interval.
        })
      }, HEARTBEAT_INTERVAL_MS)

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(heartbeat)
          resolve()
        })
      })
    })
  })

  return app
}
