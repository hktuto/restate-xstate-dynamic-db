import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context } from 'hono'
import { signObject, unsignObject } from 'shared'
import { getEnv } from '../env.js'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 1 day
}

function getSessionSecret(): string {
  return getEnv().sessionSecret
}

export interface TenantSession {
  accountId: string
  profileId: string
}

export interface TenantCompanyCookie {
  id: string
  slug: string
  namespace: string
}

export interface AdminSession {
  userId: string
  email: string
}

export function readTenantSession(c: Context): TenantSession | null {
  const raw = getCookie(c, 'tenant_session')
  if (!raw) return null
  try {
    return unsignObject<TenantSession>(raw, getEnv().sessionSecret)
  } catch {
    return null
  }
}

export function readTenantCompany(c: Context): TenantCompanyCookie | null {
  const raw = getCookie(c, 'company')
  if (!raw) return null
  try {
    return JSON.parse(raw) as TenantCompanyCookie
  } catch {
    return null
  }
}

export function readAdminSession(c: Context): AdminSession | null {
  const raw = getCookie(c, 'admin_session')
  if (!raw) return null
  try {
    return unsignObject<AdminSession>(raw, getEnv().sessionSecret)
  } catch {
    return null
  }
}

export function setTenantSession(c: Context, session: TenantSession) {
  setCookie(c, 'tenant_session', signObject(session, getSessionSecret()), COOKIE_OPTIONS)
}

export function clearTenantSession(c: Context) {
  deleteCookie(c, 'tenant_session', { path: '/' })
}

export function setTenantCompany(c: Context, company: TenantCompanyCookie) {
  setCookie(c, 'company', JSON.stringify(company), COOKIE_OPTIONS)
}

export function clearTenantCompany(c: Context) {
  deleteCookie(c, 'company', { path: '/' })
}

export function setAdminSession(c: Context, session: AdminSession) {
  setCookie(c, 'admin_session', signObject(session, getSessionSecret()), COOKIE_OPTIONS)
}

export function clearAdminSession(c: Context) {
  deleteCookie(c, 'admin_session', { path: '/' })
}
