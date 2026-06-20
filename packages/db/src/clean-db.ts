// packages/db/src/clean-db.ts
import { getSurreal, closeSurreal, closeSurrealPool } from './client.js'

export async function cleanDb() {
  const surreal = await getSurreal()
  try {
    const [info] = await surreal.query<[{
      namespaces?: Record<string, string>
    }]>('INFO FOR KV')

    const namespaces = info?.namespaces ? Object.keys(info.namespaces) : []

    for (const namespace of namespaces) {
      await surreal.query(`REMOVE NAMESPACE IF EXISTS ${namespace}`)
      console.log(`Removed namespace: ${namespace}`)
    }

    if (namespaces.length === 0) {
      console.log('No namespaces found; database is already clean')
    } else {
      console.log(`Cleaned ${namespaces.length} namespace(s)`)
    }
  } finally {
    await closeSurreal(surreal)
  }

  // Pooled connections are now pointing at removed namespaces; close them all
  await closeSurrealPool()
}

export async function cleanDbUnsafe() {
  console.warn('cleanDbUnsafe() is deprecated; use cleanDb()')
  return cleanDb()
}
