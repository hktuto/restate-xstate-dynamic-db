import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addConnection, removeConnection, deliverToUsers, clearConnections, normalizeUserIds } from './connection-manager.js'
import type { SSEStreamingApi } from 'hono/streaming'

function mockStream(): SSEStreamingApi {
  return {
    writeSSE: vi.fn().mockResolvedValue(undefined),
    onAbort: vi.fn(),
    aborted: false,
    closed: false,
  } as unknown as SSEStreamingApi
}

describe('connection manager', () => {
  beforeEach(() => {
    clearConnections()
  })

  it('delivers an event to a connected user', async () => {
    const stream = mockStream()
    addConnection('user:1', stream)
    const results = await deliverToUsers(['user:1'], { type: 'test', payload: { ok: true } })
    expect(results).toEqual([{ userId: 'user:1', delivered: true }])
    expect(stream.writeSSE).toHaveBeenCalledOnce()
  })

  it('reports not-connected for offline users', async () => {
    const results = await deliverToUsers(['user:off'], { type: 'test', payload: {} })
    expect(results).toEqual([{ userId: 'user:off', delivered: false, reason: 'not-connected' }])
  })

  it('removes a connection', async () => {
    const stream = mockStream()
    addConnection('user:2', stream)
    removeConnection('user:2', stream)
    const results = await deliverToUsers(['user:2'], { type: 'test', payload: {} })
    expect(results).toEqual([{ userId: 'user:2', delivered: false, reason: 'not-connected' }])
  })

  it('delivers to multiple connections for the same user', async () => {
    const a = mockStream()
    const b = mockStream()
    addConnection('user:3', a)
    addConnection('user:3', b)
    await deliverToUsers(['user:3'], { type: 'test', payload: {} })
    expect(a.writeSSE).toHaveBeenCalledOnce()
    expect(b.writeSSE).toHaveBeenCalledOnce()
  })

  it('removes a connection via onAbort handler', async () => {
    const stream = mockStream()
    addConnection('user:abort', stream)
    const handler = (stream.onAbort as ReturnType<typeof vi.fn>).mock.calls[0][0]
    handler()
    const results = await deliverToUsers(['user:abort'], { type: 'test', payload: {} })
    expect(results).toEqual([{ userId: 'user:abort', delivered: false, reason: 'not-connected' }])
  })

  it('reports delivery-error when writeSSE fails', async () => {
    const stream = mockStream()
    ;(stream.writeSSE as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'))
    addConnection('user:err', stream)
    const results = await deliverToUsers(['user:err'], { type: 'test', payload: {} })
    expect(results).toEqual([{ userId: 'user:err', delivered: false, reason: 'delivery-error' }])
  })

  it('normalizes a single userId to an array', () => {
    expect(normalizeUserIds('user:1')).toEqual(['user:1'])
  })

  it('passes an array of userIds through', () => {
    expect(normalizeUserIds(['user:1', 'user:2'])).toEqual(['user:1', 'user:2'])
  })
})
