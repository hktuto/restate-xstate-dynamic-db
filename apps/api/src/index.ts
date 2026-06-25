import { serve } from '@hono/node-server'
import { createApp } from './app.js'

const port = Number(process.env.API_PORT ?? '3002')
const app = createApp()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`)

  const healthMonitorUrl = process.env.HEALTH_MONITOR_URL
  if (healthMonitorUrl) {
    fetch(`${healthMonitorUrl}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => 'unknown')
          console.warn(`Startup health refresh failed: HTTP ${res.status} ${text}`)
          return
        }
        console.log('Startup health refresh triggered')
      })
      .catch((err) => {
        console.warn('Failed to reach health-monitor on startup:', err instanceof Error ? err.message : String(err))
      })
  }
})
