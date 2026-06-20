import { beforeAll } from 'vitest'
import { ensurePlatformNamespace } from './helpers.js'

const TEST_SURREAL_URL = 'ws://127.0.0.1:8001/rpc'

if (process.env.SURREAL_URL !== TEST_SURREAL_URL) {
  throw new Error(
    `DB tests must run against the test SurrealDB instance. ` +
    `Expected SURREAL_URL=${TEST_SURREAL_URL}, got ${process.env.SURREAL_URL}`
  )
}

beforeAll(async () => {
  await ensurePlatformNamespace()
})
