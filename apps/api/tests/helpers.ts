import { createAccessToken } from '../src/lib/session.js'

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-secret'
}

export function signTenantAccessTokenCookie(accountId: string, profileId: string, email = 'test@example.com') {
  const { token } = createAccessToken({
    sessionId: `sessions:test-${profileId}`,
    accountId,
    profileId,
    type: 'user',
    email,
  })
  return encodeURIComponent(token)
}

export function signAdminAccessTokenCookie(userId: string, email: string) {
  const { token } = createAccessToken({
    sessionId: `sessions:test-${userId}`,
    accountId: userId,
    profileId: userId,
    type: 'user',
    email,
  })
  return encodeURIComponent(token)
}
