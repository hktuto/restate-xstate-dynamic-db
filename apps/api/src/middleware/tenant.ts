import { createMiddleware } from 'hono/factory'
import { getMemberByProfileId } from 'db/tenant'
import { readTenantCompany } from '../lib/session.js'
import { tenantSessionMiddleware } from './session.js'
import type { ApiScope } from '../types.js'

declare module 'hono' {
  interface ContextVariableMap {
    scope: ApiScope
    tenantSession: import('../lib/session.js').TenantSession
  }
}

export const tenantSession = createMiddleware(async (c, next) => {
  return tenantSessionMiddleware(c, async () => {
    const session = c.get('tenantSession')
    c.set('scope', {
      type: 'tenant',
      namespace: '',
      database: '',
      accountId: session.accountId,
      profileId: session.profileId,
      memberId: '',
      role: 'member',
      session,
    })
    return next()
  })
})

export const tenantAuth = createMiddleware(async (c, next) => {
  return tenantSessionMiddleware(c, async () => {
    const session = c.get('tenantSession')
    const company = readTenantCompany(c)
    if (!company) {
      return c.json({ error: 'Missing company context' }, 400)
    }
    const member = await getMemberByProfileId(company.namespace, session.profileId)
    if (!member || member.status !== 'active') {
      return c.json({ error: 'Forbidden' }, 403)
    }
    c.set('scope', {
      type: 'tenant',
      namespace: company.namespace,
      database: 'main',
      accountId: session.accountId,
      profileId: session.profileId,
      memberId: member.id,
      role: member.role,
      session,
    })
    return next()
  })
})
