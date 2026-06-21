import { defineConfig, mergeConfig } from 'vitest/config'
import base from '../../vitest.base.config.js'

export default mergeConfig(base, defineConfig({
  test: {
    hookTimeout: 30000,
    testTimeout: 30000,
    globalSetup: ['./tests/global-setup.ts'],
  },
}))
