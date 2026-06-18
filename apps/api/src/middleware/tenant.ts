import { createMiddleware } from 'hono/factory'
import { getMemberByProfileId } from 'db/tenant'
import { readTenantSession, readTenantCompany } from '../lib/session.js'
import type { ApiScope } from '../types.js'

declare module 'hono' {
  interface ContextVariableMap {
    scope: ApiScope
  }
}

export const tenantAuth = createMiddleware(async (c, next) => {
  const session = readTenantSession(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
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
  })
  await next()
})
