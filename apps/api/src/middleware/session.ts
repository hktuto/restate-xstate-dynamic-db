import type { Context } from 'hono'
import type { AccessTokenPayload } from 'shared'
import {
  readTenantAccessToken,
  readTenantRefreshToken,
  readAdminAccessToken,
  readAdminRefreshToken,
  verifyAccessTokenCookie,
  clearTenantSession,
  clearAdminSession,
  clearTenantCompany,
  setTenantSessionCookies,
  setAdminSessionCookies,
} from '../lib/session.js'
import { refreshSession } from '../lib/refresh-session.js'
import type { TenantSession, AdminSession } from '../lib/session.js'

type SessionNext = () => Promise<void | Response>

interface SessionMiddlewareConfig<T extends TenantSession | AdminSession> {
  readAccess: (c: Context) => string | undefined
  readRefresh: (c: Context) => string | undefined
  build: (payload: AccessTokenPayload) => T
  setCookies: (c: Context, accessToken: string, refreshToken: string) => void
  clear: (c: Context) => void
  clearExtras?: (c: Context) => void
  key: 'tenantSession' | 'adminSession'
  refreshRole: 'user' | 'admin'
}

function buildSessionMiddleware<T extends TenantSession | AdminSession>(config: SessionMiddlewareConfig<T>) {
  return async (c: Context, next: SessionNext) => {
    let session: T | null = null

    const accessToken = config.readAccess(c)
    if (accessToken) {
      const payload = verifyAccessTokenCookie(accessToken)
      if (payload) {
        session = config.build(payload)
      }
    }

    if (!session) {
      const refreshToken = config.readRefresh(c)
      if (refreshToken) {
        const result = await refreshSession('platform', refreshToken, config.refreshRole)
        if (result) {
          config.setCookies(c, result.accessToken, result.refreshToken)
          session = result.session as T
        }
      }
    }

    if (!session) {
      config.clear(c)
      config.clearExtras?.(c)
      return c.json({ error: 'Unauthorized' }, 401)
    }

    c.set(config.key, session)
    return next()
  }
}

export const tenantSessionMiddleware = buildSessionMiddleware<TenantSession>({
  readAccess: readTenantAccessToken,
  readRefresh: readTenantRefreshToken,
  build: (payload) => ({
    sessionId: payload.sessionId,
    accountId: payload.accountId,
    profileId: payload.profileId,
    companyId: payload.companyId,
    type: payload.type,
    impersonatorId: payload.impersonatorId,
  }),
  setCookies: setTenantSessionCookies,
  clear: clearTenantSession,
  clearExtras: clearTenantCompany,
  key: 'tenantSession',
  refreshRole: 'user',
})

export const adminSessionMiddleware = buildSessionMiddleware<AdminSession>({
  readAccess: readAdminAccessToken,
  readRefresh: readAdminRefreshToken,
  build: (payload) => ({
    sessionId: payload.sessionId,
    userId: payload.accountId,
    email: payload.email ?? '',
  }),
  setCookies: setAdminSessionCookies,
  clear: clearAdminSession,
  key: 'adminSession',
  refreshRole: 'admin',
})
