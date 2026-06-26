import type { SSEStreamingApi } from 'hono/streaming'
import { randomUUID } from 'node:crypto'
import type { DeliverResult, PushEvent } from './types.js'

const connections = new Map<string, Set<SSEStreamingApi>>()

export const metrics = {
  connectionsTotal: 0,
  deliveredTotal: 0,
  notConnectedTotal: 0,
  deliveryErrorsTotal: 0,
}

export function getMetrics() {
  return { ...metrics }
}

export function addConnection(userId: string, stream: SSEStreamingApi): void {
  let set = connections.get(userId)
  if (!set) {
    set = new Set()
    connections.set(userId, set)
  }
  set.add(stream)
  metrics.connectionsTotal++
  console.debug(`[push] connect user=${userId} total=${metrics.connectionsTotal}`)
  stream.onAbort(() => {
    removeConnection(userId, stream)
  })
}

export function removeConnection(userId: string, stream: SSEStreamingApi): void {
  const set = connections.get(userId)
  if (!set) return
  set.delete(stream)
  metrics.connectionsTotal--
  console.debug(`[push] disconnect user=${userId} total=${metrics.connectionsTotal}`)
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
      metrics.notConnectedTotal++
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
      metrics.deliveredTotal++
      results.push({ userId, delivered: true })
    } catch {
      metrics.deliveryErrorsTotal++
      results.push({ userId, delivered: false, reason: 'delivery-error' })
    }
  }

  console.info(`[push] deliver users=${userIds.length} delivered=${metrics.deliveredTotal} notConnected=${metrics.notConnectedTotal} errors=${metrics.deliveryErrorsTotal}`)

  return results
}
