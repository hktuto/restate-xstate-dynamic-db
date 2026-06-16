import { describe, it, expect } from 'vitest'
import { getSurreal, closeSurreal } from '../src/client.js'

describe('client', () => {
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
})
