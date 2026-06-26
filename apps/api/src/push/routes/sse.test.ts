import { describe, it, expect } from 'vitest'
import { createApp } from '../../app.js'
import { createAccessToken } from '../../lib/session.js'

function tenantCookie(accountId: string): string {
  const { token } = createAccessToken({
    sessionId: 'sess:test',
    accountId,
    profileId: 'prof:test',
    type: 'user',
  })
  return `tenant_access_token=${encodeURIComponent(token)}`
}

describe('push sse route', () => {
  it('returns 401 without a session', async () => {
    const app = createApp()
    const res = await app.request('/push/sse')
    expect(res.status).toBe(401)
  })

  it('opens an SSE stream for an authenticated tenant', async () => {
    const app = createApp()
    const controller = new AbortController()
    const res = await app.request('/push/sse', {
      headers: { Cookie: tenantCookie('acc:test') },
      signal: controller.signal,
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      if (buffer.includes('event: connected')) {
        reader.releaseLock()
        controller.abort()
        break
      }
    }
  })
})
