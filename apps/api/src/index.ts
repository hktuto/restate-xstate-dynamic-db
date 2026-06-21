import { serve } from '@hono/node-server'
import { createApp } from './app.js'

const port = Number(process.env.API_PORT ?? '3002')
const app = createApp()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`)
})
