import { signObject } from 'shared'
import { getEnv } from '../src/env.js'

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-secret'
}

export function signTenantSessionCookie(accountId: string, profileId: string) {
  const secret = getEnv().sessionSecret
  return encodeURIComponent(signObject({ accountId, profileId }, secret))
}

export function signAdminSessionCookie(userId: string, email: string) {
  const secret = getEnv().sessionSecret
  return encodeURIComponent(signObject({ userId, email }, secret))
}
