import type { SSEStreamingApi } from 'hono/streaming'
import { randomUUID } from 'node:crypto'
import type { DeliverResult, PushEvent } from './types.js'

const connections = new Map<string, Set<SSEStreamingApi>>()

export function addConnection(userId: string, stream: SSEStreamingApi): void {
  let set = connections.get(userId)
  if (!set) {
    set = new Set()
    connections.set(userId, set)
  }
  set.add(stream)
  stream.onAbort(() => {
    removeConnection(userId, stream)
  })
}

export function removeConnection(userId: string, stream: SSEStreamingApi): void {
  const set = connections.get(userId)
  if (!set) return
  set.delete(stream)
  if (set.size === 0) {
    connections.delete(userId)
  }
}

export function normalizeUserIds(userId: string | string[]): string[] {
  return Array.isArray(userId) ? userId : [userId]
}

export function clearConnections(): void {
  connections.clear()
}

export async function deliverToUsers(userIds: string[], event: PushEvent): Promise<DeliverResult[]> {
  const results: DeliverResult[] = []
  const id = randomUUID()
  const data = JSON.stringify(event.payload)

  for (const userId of userIds) {
    const set = connections.get(userId)
    if (!set || set.size === 0) {
      results.push({ userId, delivered: false, reason: 'not-connected' })
      continue
    }

    try {
      await Promise.all(
        [...set].map((stream) =>
          stream.writeSSE({
            event: event.type,
            data,
            id,
          })
        )
      )
      results.push({ userId, delivered: true })
    } catch {
      results.push({ userId, delivered: false, reason: 'delivery-error' })
    }
  }

  return results
}
