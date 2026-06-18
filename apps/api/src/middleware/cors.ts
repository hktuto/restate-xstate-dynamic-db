import { cors } from 'hono/cors'
import { getEnv } from '../env.js'

export function createCorsMiddleware() {
  const { webUrl, adminUrl } = getEnv()
  return cors({
    origin: [webUrl, adminUrl],
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
}
