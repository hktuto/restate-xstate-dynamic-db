import { Hono } from 'hono'
import { getPlatformStatus } from 'db/platform-status'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

app.get('/platform-status', async (c) => {
    return c.json(await getPlatformStatus())
  })

export const platformRoutes = app
