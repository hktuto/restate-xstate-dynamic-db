import { seed } from 'db/seed'
import { closeSurrealPool } from 'db/client'

export async function setup() {
  await seed()
}

export async function teardown() {
  await closeSurrealPool()
}
