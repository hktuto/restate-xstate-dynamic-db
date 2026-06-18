// packages/db/scripts/schema-benchmark.ts
import { provisionCompanyNamespace } from '../src/provision.js'
import { syncTableSchemaFromRecords, listUserTables, getTableSchema } from '../src/schema-registry.js'
import { getSurreal, closeSurreal, closeSurrealPool } from '../src/client.js'

const TEST_NS = `bench_schema_${Date.now()}`
const ROWS = 1000

async function main() {
  await provisionCompanyNamespace(TEST_NS)
  const surreal = await getSurreal(TEST_NS, 'main')

  console.log(`Seeding ${ROWS} records...`)
  const startSeed = performance.now()
  for (let i = 0; i < ROWS; i++) {
    await surreal.query(
      `UPSERT contacts:${i} SET name = $name, age = $age, active = $active`,
      { name: `User ${i}`, age: i % 100, active: i % 2 === 0 }
    )
  }
  console.log(`Seeded in ${(performance.now() - startSeed).toFixed(2)}ms`)

  console.log('Syncing schema...')
  const startSync = performance.now()
  await syncTableSchemaFromRecords(TEST_NS, 'main', 'contacts', 100)
  console.log(`Synced in ${(performance.now() - startSync).toFixed(2)}ms`)

  console.log('Listing tables...')
  const startList = performance.now()
  await listUserTables(TEST_NS, 'main')
  console.log(`Listed in ${(performance.now() - startList).toFixed(2)}ms`)

  console.log('Getting schema...')
  const startSchema = performance.now()
  await getTableSchema(TEST_NS, 'main', 'contacts')
  console.log(`Got schema in ${(performance.now() - startSchema).toFixed(2)}ms`)

  await closeSurreal(surreal)

  console.log('Cleaning up...')
  const rootSurreal = await getSurreal()
  try {
    await rootSurreal.query(`REMOVE NAMESPACE IF EXISTS ${TEST_NS}`)
  } finally {
    await closeSurreal(rootSurreal)
  }

  await closeSurrealPool()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
