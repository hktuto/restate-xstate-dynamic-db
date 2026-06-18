import { provisionCompanyNamespace } from './packages/db/src/provision.js'
import { upsertTable, getTableSchema } from './packages/db/src/schema-registry.js'
import { getSurreal, closeSurreal } from './packages/db/src/client.js'

const ns = `verify_${Date.now()}`
await provisionCompanyNamespace(ns)
const surreal = await getSurreal(ns, 'main')
await surreal.query(`UPSERT contacts:test SET name = 'Alice', age = 30`)
await closeSurreal(surreal)
await upsertTable(ns, 'main', { name: 'contacts', label: 'My Contacts', description: 'desc' })
const schema = await getTableSchema(ns, 'main', 'contacts')
console.log('table:', JSON.stringify(schema.table, null, 2))
const cleanup = await getSurreal(ns, 'main')
await cleanup.query(`REMOVE NAMESPACE IF EXISTS ${ns}`)
await closeSurreal(cleanup)
