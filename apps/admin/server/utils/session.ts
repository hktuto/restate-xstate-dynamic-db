import { signObject, unsignObject } from 'shared/server'
import type { H3Event } from 'h3'

export interface AdminSession {
  userId: string
  email: string
}

const SESSION_COOKIE = 'admin_session'

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET is required')
  }
  return secret
}

export function setAdminSession(event: H3Event, session: AdminSession) {
  setCookie(event, SESSION_COOKIE, signObject(session, getSessionSecret()), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 // 1 day
  })
}

export function getAdminSession(event: H3Event): AdminSession | null {
  const cookie = getCookie(event, SESSION_COOKIE)
  if (!cookie) return null
  return unsignObject<AdminSession>(cookie, getSessionSecret())
}

export function requireAdminSession(event: H3Event): AdminSession {
  const session = getAdminSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}

export function clearAdminSession(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
