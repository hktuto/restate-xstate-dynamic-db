import { Surreal } from 'surrealdb'

const SURREAL_URL = process.env.SURREAL_URL || 'http://127.0.0.1:8000/rpc'
const SURREAL_USER = process.env.SURREAL_USER || 'root'
const SURREAL_PASS = process.env.SURREAL_PASS || 'root'

const DEFAULT_NS = process.env.SURREALDB_NS || process.env.SURREAL_NS
const DEFAULT_DB = process.env.SURREALDB_DB || process.env.SURREAL_DB

let MAX_POOL_SIZE = Number(process.env.SURREALDB_POOL_MAX ?? 20)
let IDLE_TIMEOUT_MS = Number(process.env.SURREALDB_POOL_IDLE_TIMEOUT_MS ?? 30_000)
let ACQUIRE_TIMEOUT_MS = Number(process.env.SURREALDB_POOL_ACQUIRE_TIMEOUT_MS ?? 10_000)

interface PooledConnection {
  surreal: Surreal
  key: string
  inUse: boolean
  lastUsedAt: number
  createdAt: number
}

const pool: PooledConnection[] = []

function makeKey(namespace: string, database: string): string {
  return `${namespace}--${database}`
}

function parseKey(key: string): { namespace: string; database: string } {
  const [namespace, database] = key.split('--')
  return { namespace, database }
}

async function createConnection(key: string): Promise<Surreal> {
  const { namespace, database } = parseKey(key)
  const surreal = new Surreal()
  await surreal.connect(SURREAL_URL, { namespace, database })
  await surreal.signin({ username: SURREAL_USER, password: SURREAL_PASS })
  return surreal
}

function evictIdleIfOverLimit(): void {
  const now = Date.now()
  for (let i = pool.length - 1; i >= 0; i--) {
    const c = pool[i]
    if (c.inUse) continue
    if (pool.length > MAX_POOL_SIZE || now - c.lastUsedAt > IDLE_TIMEOUT_MS) {
      c.surreal.close().catch(() => {})
      pool.splice(i, 1)
    }
  }
}

function kickOutOldestIdle(): PooledConnection | undefined {
  let oldest: PooledConnection | undefined
  for (const c of pool) {
    if (c.inUse) continue
    if (!oldest || c.lastUsedAt < oldest.lastUsedAt) {
      oldest = c
    }
  }
  if (oldest) {
    oldest.surreal.close().catch(() => {})
    const idx = pool.indexOf(oldest)
    if (idx !== -1) pool.splice(idx, 1)
  }
  return oldest
}

function waitForConnection(key: string): Promise<Surreal> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      // Prefer reusing an idle connection with the same key
      const idleSame = pool.find((c) => !c.inUse && c.key === key)
      if (idleSame) {
        idleSame.inUse = true
        idleSame.lastUsedAt = Date.now()
        clearInterval(interval)
        resolve(idleSame.surreal)
        return
      }

      // Otherwise kick out any idle connection and create one for this key
      const idleAny = pool.find((c) => !c.inUse)
      if (idleAny) {
        idleAny.surreal.close().catch(() => {})
        const idx = pool.indexOf(idleAny)
        if (idx !== -1) pool.splice(idx, 1)
        createConnection(key)
          .then((surreal) => {
            pool.push({ surreal, key, inUse: true, lastUsedAt: Date.now(), createdAt: Date.now() })
            clearInterval(interval)
            resolve(surreal)
          })
          .catch((err) => {
            clearInterval(interval)
            reject(err)
          })
        return
      }

      if (Date.now() - start > ACQUIRE_TIMEOUT_MS) {
        clearInterval(interval)
        reject(new Error(`SurrealDB connection pool exhausted (max=${MAX_POOL_SIZE})`))
      }
    }, 10)
  })
}

export function configurePool(options: {
  max?: number
  idleTimeoutMs?: number
  acquireTimeoutMs?: number
}): void {
  if (options.max !== undefined) MAX_POOL_SIZE = options.max
  if (options.idleTimeoutMs !== undefined) IDLE_TIMEOUT_MS = options.idleTimeoutMs
  if (options.acquireTimeoutMs !== undefined) ACQUIRE_TIMEOUT_MS = options.acquireTimeoutMs
}

export async function getSurreal(namespace?: string, database?: string): Promise<Surreal> {
  const ns = namespace || DEFAULT_NS
  const db = database || DEFAULT_DB

  // Operations without a namespace/database are typically root-level admin
  // commands (e.g. DEFINE NAMESPACE). Don't pool those; create a fresh connection.
  if (!ns || !db) {
    const surreal = new Surreal()
    await surreal.connect(SURREAL_URL)
    await surreal.signin({ username: SURREAL_USER, password: SURREAL_PASS })
    return surreal
  }

  const key = makeKey(ns, db)

  // 1. Reuse idle connection on the same namespace/database
  const idleSame = pool.find((c) => !c.inUse && c.key === key)
  if (idleSame) {
    idleSame.inUse = true
    idleSame.lastUsedAt = Date.now()
    return idleSame.surreal
  }

  // 2. Create new if under max pool size
  if (pool.length < MAX_POOL_SIZE) {
    const surreal = await createConnection(key)
    pool.push({ surreal, key, inUse: true, lastUsedAt: Date.now(), createdAt: Date.now() })
    return surreal
  }

  // 3. Pool is full — kick out the oldest idle connection
  const kicked = kickOutOldestIdle()
  if (kicked) {
    const surreal = await createConnection(key)
    pool.push({ surreal, key, inUse: true, lastUsedAt: Date.now(), createdAt: Date.now() })
    return surreal
  }

  // 4. All connections are busy; wait for one
  return waitForConnection(key)
}

export async function closeSurreal(surreal: Surreal): Promise<void> {
  const entry = pool.find((c) => c.surreal === surreal)
  if (!entry) {
    await surreal.close()
    return
  }
  entry.inUse = false
  entry.lastUsedAt = Date.now()
  evictIdleIfOverLimit()
}

export async function closeSurrealPool(): Promise<void> {
  await Promise.all(pool.map((c) => c.surreal.close().catch(() => {})))
  pool.length = 0
}
