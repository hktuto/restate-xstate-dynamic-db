import { cors } from 'hono/cors'

export function createCorsMiddleware() {
  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000'
  const adminUrl = process.env.ADMIN_URL ?? 'http://localhost:3001'
  return cors({
    origin: [webUrl, adminUrl],
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
}
