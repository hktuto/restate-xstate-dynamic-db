import * as restate from '@restatedev/restate-sdk'
import http from 'node:http'
import { workflowObject } from './workflow.js'

const handler = restate.endpoint().bind(workflowObject).handler()
const PORT = Number(process.env.PORT) || 9080

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    if (pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }
    await handler(req, res)
  } catch (err) {
    console.error('Request handler error:', err)
    if (!res.headersSent) {
      res.writeHead(500)
      res.end('Internal Server Error')
    }
  }
})

server.on('error', (err) => {
  console.error('Server error:', err)
})

server.listen(PORT, () => {
  console.log(`Workflow runtime listening on ${PORT}`)
})
