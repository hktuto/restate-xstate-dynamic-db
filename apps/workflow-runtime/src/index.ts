import * as restate from '@restatedev/restate-sdk'
import http from 'node:http'
import { workflowObject } from './workflow.js'

const PORT = Number(process.env.PORT) || 9080
const HEALTH_PORT = Number(process.env.HEALTH_PORT) || 9081

// Restate HTTP/2 endpoint
restate
  .serve({
    services: [workflowObject],
    port: PORT,
  })
  .then((actualPort) => {
    console.log(`Workflow runtime listening on ${actualPort}`)
  })
  .catch((err) => {
    console.error('Failed to start workflow runtime:', err)
    process.exit(1)
  })

// Simple HTTP/1.1 health endpoint for Docker/compose health checks
const healthServer = http.createServer((req, res) => {
  try {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }
    res.writeHead(404)
    res.end('Not found')
  } catch (err) {
    console.error('Health handler error:', err)
    if (!res.headersSent) {
      res.writeHead(500)
      res.end('Internal Server Error')
    }
  }
})

healthServer.on('error', (err) => {
  console.error('Health server error:', err)
})

healthServer.listen(HEALTH_PORT, () => {
  console.log(`Health endpoint listening on ${HEALTH_PORT}`)
})
