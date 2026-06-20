import { describe, it, expect } from 'vitest'

describe('test environment', () => {
  it('uses the dedicated test SurrealDB URL', () => {
    expect(process.env.SURREAL_URL).toBe('ws://127.0.0.1:8001/rpc')
  })
})
