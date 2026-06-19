import type { Context } from 'hono'
import {
  readTenantAccessToken,
  readTenantRefreshToken,
  readAdminAccessToken,
  readAdminRefreshToken,
  readTenantCompany,
  verifyAccessTokenCookie,
  clearTenantSession,
  clearAdminSession,
  clearTenantCompany,
  setTenantSessionCookies,
  setAdminSessionCookies,
} from '../lib/session.js'
import { refreshTenantSession, refreshAdminSession } from '../lib/refresh-session.js'
import type { TenantSession, AdminSession } from '../lib/session.js'

type SessionNext = () => Promise<void | Response>

export async function tenantSessionMiddleware(c: Context, next: SessionNext) {
  const accessToken = readTenantAccessToken(c)
  let session: TenantSession | null = null

  if (accessToken) {
    const payload = verifyAccessTokenCookie(accessToken)
    if (payload) {
      session = {
        sessionId: payload.sessionId,
        accountId: payload.accountId,
        profileId: payload.profileId,
        companyId: payload.companyId,
        type: payload.type,
        impersonatorId: payload.impersonatorId,
      }
    }
  }

  if (!session) {
    const refreshToken = readTenantRefreshToken(c)
    const company = readTenantCompany(c)
    if (refreshToken && company) {
      const result = await refreshTenantSession(company.namespace, refreshToken)
      if (result) {
        setTenantSessionCookies(c, result.accessToken, result.refreshToken)
        session = result.session as TenantSession
      }
    }
  }

  if (!session) {
    clearTenantSession(c)
    clearTenantCompany(c)
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('tenantSession', session)
  return next()
}

export async function adminSessionMiddleware(c: Context, next: SessionNext) {
  const accessToken = readAdminAccessToken(c)
  let session: AdminSession | null = null

  if (accessToken) {
    const payload = verifyAccessTokenCookie(accessToken)
    if (payload) {
      session = {
        sessionId: payload.sessionId,
        userId: payload.accountId,
        email: payload.email ?? '',
      }
    }
  }

  if (!session) {
    const refreshToken = readAdminRefreshToken(c)
    if (refreshToken) {
      const result = await refreshAdminSession('platform', refreshToken)
      if (result) {
        setAdminSessionCookies(c, result.accessToken, result.refreshToken)
        session = result.session as AdminSession
      }
    }
  }

  if (!session) {
    clearAdminSession(c)
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('adminSession', session)
  return next()
}
