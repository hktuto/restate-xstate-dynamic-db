import { createMiddleware } from 'hono/factory'
import { readAdminSession } from '../lib/session.js'
import type { AdminScope } from '../types.js'

function parseNsdb(nsdb: string) {
  const parts = nsdb.split('--')
  if (parts.length !== 2) {
    throw new Error(`Invalid namespace--database key: ${nsdb}`)
  }
  const [namespace, database] = parts
  return { namespace, database }
}

export const adminAuth = (nsdbParam = 'nsdb') =>
  createMiddleware(async (c, next) => {
    const session = readAdminSession(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    let namespace: string
    let database: string
    const nsdb = c.req.param(nsdbParam)
    if (nsdb) {
      ;({ namespace, database } = parseNsdb(nsdb))
    } else {
      namespace = 'platform'
      database = 'admin'
    }
    c.set('scope', {
      type: 'admin',
      namespace,
      database,
      userId: session.userId,
      email: session.email,
    })
    await next()
  })
