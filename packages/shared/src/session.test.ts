import { describe, it, expect } from 'vitest'
import { sign, signObject, unsign, unsignObject, signAccessToken, verifyAccessToken } from './session.js'

const SECRET = 'test-secret'

describe('session signing', () => {
  it('round-trips a signed string', () => {
    const value = 'hello-world'
    const signed = sign(value, SECRET)
    expect(unsign(signed, SECRET)).toBe(value)
  })

  it('round-trips a signed object', () => {
    const obj = { accountId: 'a1', profileId: 'p1' }
    const signed = signObject(obj, SECRET)
    expect(unsignObject(signed, SECRET)).toEqual(obj)
  })

  it('rejects a tampered payload', () => {
    const obj = { accountId: 'a1', profileId: 'p1' }
    const signed = signObject(obj, SECRET)
    const tampered = signed.replace('a1', 'a2')
    expect(unsignObject(tampered, SECRET)).toBeNull()
  })

  it('rejects a signature with the wrong secret', () => {
    const obj = { accountId: 'a1', profileId: 'p1' }
    const signed = signObject(obj, SECRET)
    expect(unsignObject(signed, 'wrong-secret')).toBeNull()
  })

  it('rejects a non-object JSON payload for unsignObject', () => {
    const signed = sign('"just-a-string"', SECRET)
    expect(unsignObject(signed, SECRET)).toBeNull()
  })
})

describe('access tokens', () => {
  const SECRET = 'access-token-secret'

  const basePayload = {
    sessionId: 'session-1',
    accountId: 'account-1',
    profileId: 'profile-1',
    type: 'user' as const,
    jti: 'jti-1',
    exp: Date.now() + 60_000,
  }

  it('round-trips a signed access token', () => {
    const token = signAccessToken(basePayload, SECRET)
    const verified = verifyAccessToken(token, SECRET)
    expect(verified).toMatchObject(basePayload)
  })

  it('injects iat automatically', () => {
    const before = Date.now()
    const token = signAccessToken(basePayload, SECRET)
    const verified = verifyAccessToken(token, SECRET)
    expect(verified?.iat).toBeGreaterThanOrEqual(before)
    expect(verified?.iat).toBeLessThanOrEqual(Date.now())
  })

  it('rejects an expired token', () => {
    const expiredPayload = { ...basePayload, exp: Date.now() - 1 }
    const token = signAccessToken(expiredPayload, SECRET)
    expect(verifyAccessToken(token, SECRET)).toBeNull()
  })

  it('rejects a tampered token', () => {
    const token = signAccessToken(basePayload, SECRET)
    const tampered = token.replace(basePayload.sessionId, 'session-2')
    expect(verifyAccessToken(tampered, SECRET)).toBeNull()
  })

  it('rejects a token signed with the wrong secret', () => {
    const token = signAccessToken(basePayload, SECRET)
    expect(verifyAccessToken(token, 'wrong-secret')).toBeNull()
  })

  const signMalformed = (overrides: Record<string, unknown>) =>
    signObject({ ...basePayload, iat: Date.now(), ...overrides }, SECRET)

  it('rejects missing exp', () => {
    const { exp, ...withoutExp } = basePayload
    const noExp = signObject({ ...withoutExp, iat: Date.now() }, SECRET)
    expect(verifyAccessToken(noExp, SECRET)).toBeNull()
  })

  it('rejects non-number exp', () => {
    expect(verifyAccessToken(signMalformed({ exp: 'not-a-number' }), SECRET)).toBeNull()
  })

  it('rejects NaN exp', () => {
    expect(verifyAccessToken(signMalformed({ exp: NaN }), SECRET)).toBeNull()
  })

  it('rejects Infinity exp', () => {
    expect(verifyAccessToken(signMalformed({ exp: Infinity }), SECRET)).toBeNull()
  })

  it('rejects invalid type values', () => {
    expect(verifyAccessToken(signMalformed({ type: 'admin' }), SECRET)).toBeNull()
  })

  it('rejects non-string required fields', () => {
    expect(verifyAccessToken(signMalformed({ sessionId: 123 }), SECRET)).toBeNull()
  })

  it('rejects non-number iat', () => {
    expect(verifyAccessToken(signMalformed({ iat: 'not-a-number' }), SECRET)).toBeNull()
  })

  it('rejects NaN iat', () => {
    expect(verifyAccessToken(signMalformed({ iat: NaN }), SECRET)).toBeNull()
  })

  it('rejects Infinity iat', () => {
    expect(verifyAccessToken(signMalformed({ iat: Infinity }), SECRET)).toBeNull()
  })

  it('rejects a signed payload that is missing required fields', () => {
    const malformed = signObject({ sessionId: 'session-1', exp: Date.now() + 60_000, iat: Date.now() }, SECRET)
    expect(verifyAccessToken(malformed, SECRET)).toBeNull()
  })
})
