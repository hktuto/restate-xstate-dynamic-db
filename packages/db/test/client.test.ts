import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Surreal } from 'surrealdb'
import { getSurreal, closeSurreal, closeSurrealPool } from '../src/client.js'

describe('client', () => {
  beforeEach(async () => {
    await closeSurrealPool()
  })

  it('connects to SurrealDB and signs in', async () => {
    const surreal = await getSurreal()
    expect(surreal).toBeDefined()
    await closeSurreal(surreal)
  })

  it('connects to a specific namespace and database', async () => {
    const surreal = await getSurreal('platform', 'admin')
    expect(surreal).toBeDefined()
    await closeSurreal(surreal)
  })

  it('times out when SurrealDB connection hangs', async () => {
    process.env.SURREALDB_CONNECT_TIMEOUT_MS = '50'
    vi.resetModules()

    const { getSurreal: getSurrealWithShortTimeout } = await import('../src/client.js')
    const connectSpy = vi
      .spyOn(Surreal.prototype, 'connect')
      .mockImplementation(() => new Promise(() => {}) as Promise<true>)

    const start = Date.now()
    await expect(getSurrealWithShortTimeout('timeout-test', 'main')).rejects.toThrow(
      /SurrealDB connection to ws:\/\/127\.0\.0\.1:8001\/rpc timed out after 50ms/
    )
    expect(Date.now() - start).toBeLessThan(500)

    connectSpy.mockRestore()
    delete process.env.SURREALDB_CONNECT_TIMEOUT_MS
  })
})
