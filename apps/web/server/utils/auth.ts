import type { H3Event } from 'h3'

export interface TenantSession {
  accountId: string
  profileId: string
}

export interface TenantCompanyCookie {
  id: string
  slug: string
  namespace: string
}

const TENANT_SESSION_COOKIE = 'tenant_session'
const COMPANY_COOKIE = 'company'

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET is required')
  }
  return secret
}

export async function setTenantSession(event: H3Event, session: TenantSession) {
  const { signObject } = await import('shared')
  setCookie(event, TENANT_SESSION_COOKIE, signObject(session as unknown as Record<string, unknown>, getSessionSecret()), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 // 1 day
  })
}

export async function getTenantSession(event: H3Event): Promise<TenantSession | null> {
  const cookie = getCookie(event, TENANT_SESSION_COOKIE)
  if (!cookie) return null
  const { unsignObject } = await import('shared')
  return unsignObject(cookie, getSessionSecret()) as TenantSession | null
}

export async function requireTenantSession(event: H3Event): Promise<TenantSession> {
  const session = await getTenantSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}

export function clearTenantSession(event: H3Event) {
  deleteCookie(event, TENANT_SESSION_COOKIE, { path: '/' })
}

export function setTenantCompany(event: H3Event, company: TenantCompanyCookie) {
  setCookie(event, COMPANY_COOKIE, JSON.stringify(company), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24
  })
}

export function getTenantCompany(event: H3Event): TenantCompanyCookie | null {
  const cookie = getCookie(event, COMPANY_COOKIE)
  if (!cookie) return null
  try {
    return JSON.parse(cookie) as TenantCompanyCookie
  } catch {
    return null
  }
}

export function clearTenantCompany(event: H3Event) {
  deleteCookie(event, COMPANY_COOKIE, { path: '/' })
}
