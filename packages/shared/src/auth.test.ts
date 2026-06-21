import { describe, expect, it } from 'vitest'
import { comparePassword, hashPassword } from './auth.js'

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hashed = await hashPassword('hunter2')
    expect(hashed.startsWith('$scrypt$')).toBe(true)
    expect(await comparePassword('hunter2', hashed)).toBe(true)
    expect(await comparePassword('wrong', hashed)).toBe(false)
  })

  it('returns false for non-scrypt hashes', async () => {
    expect(await comparePassword('hunter2', '$2b$10$fakehash')).toBe(false)
  })
})
