import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { requirePermission } from './permission.js'
import type { TenantScope } from '../types.js'

describe('requirePermission', () => {
  function buildApp(bitmask: string | undefined, role: 'owner' | 'member') {
    const app = new Hono()
    app.use(async (c, next) => {
      c.set('scope', {
        type: 'tenant',
        namespace: 'company_test',
        database: 'main',
        accountId: 'accounts:1',
        profileId: 'user_profiles:1',
        memberId: 'members:1',
        role,
        permissions: bitmask ? { company: bitmask } : undefined,
      } satisfies TenantScope)
      await next()
    })
    app.get('/settings', requirePermission('company', 'manage_settings'), (c) => c.json({ ok: true }))
    return app
  }

  it('allows the action when the bit is set', async () => {
    const app = buildApp('3', 'member') // view + manage_settings
    const res = await app.request('/settings')
    expect(res.status).toBe(200)
  })

  it('blocks the action when the bit is missing', async () => {
    const app = buildApp('1', 'member') // view only
    const res = await app.request('/settings')
    expect(res.status).toBe(403)
  })

  it('allows owners automatically', async () => {
    const app = buildApp(undefined, 'owner')
    const res = await app.request('/settings')
    expect(res.status).toBe(200)
  })
})
