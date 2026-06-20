import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Load the root test env file before any test module is evaluated.
// This ensures packages that read process.env.SURREAL_URL at import time
// (e.g. packages/db/src/client.ts) see the test database URL.
const envPath = new URL('.env.test', import.meta.url)
process.loadEnvFile(envPath)

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
})
