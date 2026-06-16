import * as restate from '@restatedev/restate-sdk'
import http from 'node:http'
import { workflowObject } from './workflow.js'

const handler = restate.endpoint().bind(workflowObject).handler()

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }
  handler(req, res)
})

server.listen(9080, () => {
  console.log('Workflow runtime listening on 9080')
})
