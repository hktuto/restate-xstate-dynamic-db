import { Hono } from 'hono'
import { createSseRoute } from './routes/sse.js'
import { createDeliverRoute } from './routes/deliver.js'

export interface PushAppOptions {
  internalSecret: string
}

export function createPushApp(options: PushAppOptions) {
  const app = new Hono()
  app.route('/', createSseRoute())
  app.route('/', createDeliverRoute(options.internalSecret))
  return app
}
