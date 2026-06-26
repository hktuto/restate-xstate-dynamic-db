import { createMiddleware } from 'hono/factory'
import {
  readTenantAccessToken,
  readAdminAccessToken,
  verifyAccessTokenCookie,
} from '../../lib/session.js'

declare module 'hono' {
  interface ContextVariableMap {
    pushUserId: string
  }
}

export const pushSessionMiddleware = createMiddleware(async (c, next) => {
  const tenantAccess = readTenantAccessToken(c)
  if (tenantAccess) {
    const payload = verifyAccessTokenCookie(tenantAccess)
    if (payload) {
      c.set('pushUserId', payload.accountId)
      return next()
    }
  }

  const adminAccess = readAdminAccessToken(c)
  if (adminAccess) {
    const payload = verifyAccessTokenCookie(adminAccess)
    if (payload) {
      c.set('pushUserId', payload.accountId)
      return next()
    }
  }

  c.header('content-length', '0')
  return c.body(null, 401)
})
