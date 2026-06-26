import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { createAccessToken } from '../../lib/session.js'

process.env.PUSH_INTERNAL_SECRET = 'push-secret'

const TEST_USER_ID = 'acc:deliver-test'

function tenantCookie(accountId: string): string {
  const { token } = createAccessToken({
    sessionId: 'sess:test',
    accountId,
    profileId: 'prof:test',
    type: 'user',
  })
  return `tenant_access_token=${encodeURIComponent(token)}`
}

describe('push deliver route', () => {
  it('returns 401 without internal secret', async () => {
    const app = createApp()
    const res = await app.request('/push/deliver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user:1', event: { type: 'test', payload: {} } }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid body', async () => {
    const app = createApp()
    const res = await app.request('/push/deliver', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer push-secret',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    const app = createApp()
    const res = await app.request('/push/deliver', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer push-secret',
      },
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid event type', async () => {
    const app = createApp()
    const res = await app.request('/push/deliver', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer push-secret',
      },
      body: JSON.stringify({
        userId: 'user:1',
        event: { type: 'bad\n type', payload: {} },
      }),
    })
    expect(res.status).toBe(400)
  })

  it('delivers an event to a connected user', async () => {
    const app = createApp()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const sseRes = await app.request('/push/sse', {
        headers: { Cookie: tenantCookie(TEST_USER_ID) },
        signal: controller.signal,
      })

      expect(sseRes.status).toBe(200)
      expect(sseRes.headers.get('content-type')).toMatch(/text\/event-stream/)

      const reader = sseRes.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let foundConnected = false

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          if (buffer.includes('event: connected')) {
            foundConnected = true
            break
          }
        }
      } finally {
        reader.releaseLock()
      }

      expect(foundConnected).toBe(true)

      const deliverRes = await app.request('/push/deliver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer push-secret',
        },
        body: JSON.stringify({
          userId: TEST_USER_ID,
          event: { type: 'test:greeting', payload: { hello: 'world' } },
        }),
      })

      expect(deliverRes.status).toBe(200)
      const body = (await deliverRes.json()) as { results: Array<{ userId: string; delivered: boolean }> }
      expect(body.results).toHaveLength(1)
      expect(body.results[0].delivered).toBe(true)
    } finally {
      clearTimeout(timeout)
      controller.abort()
    }
  })
})
