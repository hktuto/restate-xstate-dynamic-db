export interface PushEvent {
  type: string
  payload: Record<string, unknown>
}

export interface DeliverRequest {
  userId: string | string[]
  event: PushEvent
}

export interface DeliverResult {
  userId: string
  delivered: boolean
  reason?: string
}
