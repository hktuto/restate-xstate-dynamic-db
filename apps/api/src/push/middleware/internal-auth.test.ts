import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { pushInternalAuthMiddleware } from './internal-auth.js'

describe('push internal auth', () => {
  it('allows requests with a valid secret', async () => {
    const app = new Hono().use(pushInternalAuthMiddleware('secret')).get('/', (c) => c.text('ok'))
    const res = await app.request('/', { headers: { Authorization: 'Bearer secret' } })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('rejects missing authorization', async () => {
    const app = new Hono().use(pushInternalAuthMiddleware('secret')).get('/', (c) => c.text('ok'))
    const res = await app.request('/')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('rejects invalid token', async () => {
    const app = new Hono().use(pushInternalAuthMiddleware('secret')).get('/', (c) => c.text('ok'))
    const res = await app.request('/', { headers: { Authorization: 'Bearer wrong' } })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('rejects malformed authorization scheme', async () => {
    const app = new Hono().use(pushInternalAuthMiddleware('secret')).get('/', (c) => c.text('ok'))
    const res = await app.request('/', { headers: { Authorization: 'Basic secret' } })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('throws when secret is empty', () => {
    expect(() => pushInternalAuthMiddleware('')).toThrow('PUSH_INTERNAL_SECRET is required')
  })
})
