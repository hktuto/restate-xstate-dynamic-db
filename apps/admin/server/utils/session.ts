import type { H3Event } from 'h3'

export interface AdminSession {
  userId: string
  email: string
}

const SESSION_COOKIE = 'admin_session'

export function setAdminSession(event: H3Event, session: AdminSession) {
  setCookie(event, SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 // 1 day
  })
}

export function getAdminSession(event: H3Event): AdminSession | null {
  const cookie = getCookie(event, SESSION_COOKIE)
  if (!cookie) return null
  try {
    return JSON.parse(cookie) as AdminSession
  } catch {
    return null
  }
}

export function requireAdminSession(event: H3Event): AdminSession {
  const session = getAdminSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}

export function clearAdminSession(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE)
}
