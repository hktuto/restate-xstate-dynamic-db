import { Surreal } from 'surrealdb'

const SURREAL_URL = process.env.SURREAL_URL || 'http://127.0.0.1:8000/rpc'
const SURREAL_USER = process.env.SURREAL_USER || 'root'
const SURREAL_PASS = process.env.SURREAL_PASS || 'root'

export async function getSurreal(namespace?: string, database?: string) {
  const surreal = new Surreal()
  await surreal.connect(SURREAL_URL, namespace && database ? { namespace, database } : undefined)
  await surreal.signin({ username: SURREAL_USER, password: SURREAL_PASS })
  return surreal
}

export async function closeSurreal(surreal: Surreal) {
  await surreal.close()
}
