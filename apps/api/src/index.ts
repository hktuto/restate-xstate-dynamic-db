import { serve } from '@hono/node-server'
import { getEnv } from './env.js'
import { createApp } from './app.js'

const { port } = getEnv()
const app = createApp()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`)
})
