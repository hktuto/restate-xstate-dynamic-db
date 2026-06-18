import { Hono } from 'hono'
import { getPlatformStatus } from 'db/platform-status'

export function platformRoutes() {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.get('/platform-status', async (c) => {
    return c.json(await getPlatformStatus())
  })

  app.post('/webhook', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ ok: true })
    }
    console.log('[webhook received]', body)
    return c.json({ ok: true })
  })

  return app
}
