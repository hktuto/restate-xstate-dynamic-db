import { describe, it, expect } from 'vitest'
import { createAccessToken, verifyAccessTokenCookie, createRefreshToken, hashRefreshToken } from './session.js'

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-secret'
}

describe('session helpers', () => {
  it('signs and verifies access tokens', () => {
    const { token, jti } = createAccessToken({
      sessionId: 'sess:1',
      accountId: 'acc:1',
      profileId: 'prof:1',
      type: 'user',
    })
    const payload = verifyAccessTokenCookie(token)
    expect(payload?.sessionId).toBe('sess:1')
    expect(payload?.jti).toBe(jti)
  })

  it('rejects tampered access tokens', () => {
    const { token } = createAccessToken({
      sessionId: 'sess:1',
      accountId: 'acc:1',
      profileId: 'prof:1',
      type: 'user',
    })
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect(verifyAccessTokenCookie(tampered)).toBeNull()
  })

  it('hashes refresh tokens consistently', () => {
    const { token } = createRefreshToken()
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token))
  })

  it('generates unique refresh tokens', () => {
    const a = createRefreshToken()
    const b = createRefreshToken()
    expect(a.token).not.toBe(b.token)
    expect(a.hash).not.toBe(b.hash)
  })
})
