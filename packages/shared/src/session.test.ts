import { describe, it, expect } from 'vitest'
import { sign, signObject, unsign, unsignObject } from './session.js'

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
