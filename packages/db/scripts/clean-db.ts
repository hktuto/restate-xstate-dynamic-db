// packages/db/scripts/clean-db.ts
import { fileURLToPath } from 'node:url'
import { cleanDb } from '../src/clean-db.js'

async function main() {
  await cleanDb()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('Clean DB failed:', err)
    process.exit(1)
  })
}
