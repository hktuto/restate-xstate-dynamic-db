import { createMiddleware } from 'hono/factory'
import { timingSafeEqual } from 'node:crypto'

export function pushInternalAuthMiddleware(secret: string) {
  if (!secret) {
    throw new Error('PUSH_INTERNAL_SECRET is required')
  }

  return createMiddleware(async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header || !header.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const token = header.slice(7)
    const tokenBuf = Buffer.from(token)
    const secretBuf = Buffer.from(secret)
    if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    await next()
  })
}
