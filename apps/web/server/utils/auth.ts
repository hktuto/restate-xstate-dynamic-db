import type { H3Event } from 'h3'

export interface TenantSession {
  accountId: string
  profileId: string
  companyId: string
  memberId: string
  role: 'owner' | 'admin' | 'member'
}

const TENANT_SESSION_COOKIE = 'tenant_session'

export function setTenantSession(event: H3Event, session: TenantSession) {
  setCookie(event, TENANT_SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 // 1 day
  })
}

export function getTenantSession(event: H3Event): TenantSession | null {
  const cookie = getCookie(event, TENANT_SESSION_COOKIE)
  if (!cookie) return null
  try {
    return JSON.parse(cookie) as TenantSession
  } catch {
    return null
  }
}

export function requireTenantSession(event: H3Event): TenantSession {
  const session = getTenantSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}

export function clearTenantSession(event: H3Event) {
  deleteCookie(event, TENANT_SESSION_COOKIE, { path: '/' })
}
