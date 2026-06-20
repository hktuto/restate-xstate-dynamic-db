import { defineConfig, mergeConfig } from 'vitest/config'
import base from '../../vitest.base.config.js'

export default mergeConfig(base, defineConfig({}))
