import { createMiddleware } from 'hono/factory'
import { adminSessionMiddleware } from './session.js'
import type { ApiScope } from '../types.js'

declare module 'hono' {
  interface ContextVariableMap {
    scope: ApiScope
    adminSession: import('../lib/session.js').AdminSession
  }
}

function parseNsdb(nsdb: string): { namespace: string; database: string } | null {
  const parts = nsdb.split('--')
  if (parts.length !== 2) return null
  const [namespace, database] = parts
  return { namespace, database }
}

export const adminAuth = (nsdbParam = 'nsdb') =>
  createMiddleware(async (c, next) => {
    return adminSessionMiddleware(c, async () => {
      const session = c.get('adminSession')
      const nsdb = c.req.param(nsdbParam)
      const parsed = nsdb ? parseNsdb(nsdb) : { namespace: 'platform', database: 'admin' }
      if (!parsed) {
        return c.json({ error: 'Invalid namespace--database key' }, 400)
      }
      const { namespace, database } = parsed
      c.set('scope', {
        type: 'admin',
        namespace,
        database,
        userId: session.userId,
        email: session.email,
        session,
      })
      return next()
    })
  })
