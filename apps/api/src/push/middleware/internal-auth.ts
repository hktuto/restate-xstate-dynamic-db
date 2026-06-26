import { createMiddleware } from 'hono/factory'

export function pushInternalAuthMiddleware(secret: string) {
  return createMiddleware(async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header || !header.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const token = header.slice(7)
    if (token !== secret) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    await next()
  })
}
