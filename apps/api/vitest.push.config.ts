import { defineConfig, mergeConfig } from 'vitest/config'
import base from '../../vitest.base.config.js'

export default mergeConfig(base, defineConfig({
  test: {
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      SESSION_SECRET: 'test-secret',
      PUSH_INTERNAL_SECRET: 'push-secret',
    },
  },
}))
