import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { pushSessionMiddleware } from './session.js'
import { createAccessToken } from '../../lib/session.js'

describe('push session middleware', () => {
  it('sets pushUserId for a valid tenant token', async () => {
    const { token } = createAccessToken({
      sessionId: 'sess:1',
      accountId: 'acc:1',
      profileId: 'prof:1',
      type: 'user',
    })
    const app = new Hono().use(pushSessionMiddleware).get('/', (c) => c.json({ userId: c.get('pushUserId') }))
    const res = await app.request('/', { headers: { Cookie: `tenant_access_token=${encodeURIComponent(token)}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'acc:1' })
  })

  it('sets pushUserId for a valid admin token', async () => {
    const { token } = createAccessToken({
      sessionId: 'sess:2',
      accountId: 'acc:2',
      profileId: 'prof:2',
      type: 'user',
      email: 'admin@test.co',
    })
    const app = new Hono().use(pushSessionMiddleware).get('/', (c) => c.json({ userId: c.get('pushUserId') }))
    const res = await app.request('/', { headers: { Cookie: `admin_access_token=${encodeURIComponent(token)}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'acc:2' })
  })

  it('rejects an invalid tenant token', async () => {
    const app = new Hono().use(pushSessionMiddleware).get('/', (c) => c.text('ok'))
    const res = await app.request('/', { headers: { Cookie: `tenant_access_token=invalid-token` } })
    expect(res.status).toBe(401)
  })

  it('rejects an invalid admin token', async () => {
    const app = new Hono().use(pushSessionMiddleware).get('/', (c) => c.text('ok'))
    const res = await app.request('/', { headers: { Cookie: `admin_access_token=invalid-token` } })
    expect(res.status).toBe(401)
  })

  it('returns clean 401 without a JSON body when unauthenticated', async () => {
    const app = new Hono().use(pushSessionMiddleware).get('/', (c) => c.text('ok'))
    const res = await app.request('/')
    expect(res.status).toBe(401)
    expect(res.headers.get('content-length')).toBe('0')
  })
})
