import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { AccessTokenPayload } from 'shared'
import { signAccessToken, verifyAccessToken, generateToken, hashToken } from 'shared'
import { getEnv } from '../env.js'

const ACCESS_TOKEN_COOKIE = 'tenant_access_token'
const REFRESH_TOKEN_COOKIE = 'tenant_refresh_token'
const ADMIN_ACCESS_TOKEN_COOKIE = 'admin_access_token'
const ADMIN_REFRESH_TOKEN_COOKIE = 'admin_refresh_token'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
}

function getSessionSecret(): string {
  return getEnv().sessionSecret
}

function accessTokenExpiry(): Date {
  return new Date(Date.now() + 15 * 60 * 1000)
}

function refreshTokenExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
}

export interface TenantSession {
  sessionId: string
  accountId: string
  profileId: string
  companyId?: string
  type: 'user' | 'impersonation'
  impersonatorId?: string
}

export interface TenantCompanyCookie {
  id: string
  slug: string
  namespace: string
}

export interface AdminSession {
  sessionId: string
  userId: string
  email: string
}

export function createAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'jti' | 'exp'> & { jti?: string }): { token: string; jti: string; expiresAt: Date } {
  const jti = payload.jti ?? generateToken('jti')
  const expiresAt = accessTokenExpiry()
  const token = signAccessToken(
    { ...payload, jti, exp: expiresAt.getTime() },
    getSessionSecret()
  )
  return { token, jti, expiresAt }
}

export function verifyAccessTokenCookie(token: string): AccessTokenPayload | null {
  return verifyAccessToken(token, getSessionSecret())
}

export function createRefreshToken(): { token: string; hash: string } {
  const token = generateToken('refresh')
  return { token, hash: hashToken(token) }
}

export function hashRefreshToken(token: string): string {
  return hashToken(token)
}

export function setTenantSessionCookies(c: Context, accessToken: string, refreshToken: string) {
  setCookie(c, ACCESS_TOKEN_COOKIE, accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 })
  setCookie(c, REFRESH_TOKEN_COOKIE, refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 })
}

export function setAdminSessionCookies(c: Context, accessToken: string, refreshToken: string) {
  setCookie(c, ADMIN_ACCESS_TOKEN_COOKIE, accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 })
  setCookie(c, ADMIN_REFRESH_TOKEN_COOKIE, refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 })
}

export function readTenantAccessToken(c: Context): string | undefined {
  return getCookie(c, ACCESS_TOKEN_COOKIE)
}

export function readTenantRefreshToken(c: Context): string | undefined {
  return getCookie(c, REFRESH_TOKEN_COOKIE)
}

export function readAdminAccessToken(c: Context): string | undefined {
  return getCookie(c, ADMIN_ACCESS_TOKEN_COOKIE)
}

export function readAdminRefreshToken(c: Context): string | undefined {
  return getCookie(c, ADMIN_REFRESH_TOKEN_COOKIE)
}

export function clearTenantSession(c: Context) {
  deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: '/' })
  deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: '/' })
}

export function clearAdminSession(c: Context) {
  deleteCookie(c, ADMIN_ACCESS_TOKEN_COOKIE, { path: '/' })
  deleteCookie(c, ADMIN_REFRESH_TOKEN_COOKIE, { path: '/' })
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

export function setTenantCompany(c: Context, company: TenantCompanyCookie) {
  setCookie(c, 'company', JSON.stringify(company), COOKIE_OPTIONS)
}

export function clearTenantCompany(c: Context) {
  deleteCookie(c, 'company', { path: '/' })
}
