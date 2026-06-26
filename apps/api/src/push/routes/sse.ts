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
