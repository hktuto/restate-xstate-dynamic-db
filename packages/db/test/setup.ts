import { beforeAll } from 'vitest'
import { ensurePlatformNamespace } from './helpers.js'

beforeAll(async () => {
  await ensurePlatformNamespace()
})
