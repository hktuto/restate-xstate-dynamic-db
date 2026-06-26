import { ref, onScopeDispose } from 'vue'

export interface PushMessage<T = unknown> {
  id?: string
  type: string
  payload: T
}

interface ListenerEntry {
  instanceId: string
  callback: (msg: PushMessage) => void
}

interface PushState {
  eventSource: EventSource | null
  connected: ReturnType<typeof ref<boolean>>
  listeners: Map<string, Set<ListenerEntry>>
  busListeners: Map<string, (event: MessageEvent) => void>
}

const state: PushState = {
  eventSource: null,
  connected: ref(false),
  listeners: new Map(),
  busListeners: new Map(),
}

function generateInstanceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function createBusListener(type: string): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    const entries = state.listeners.get(type)
    if (!entries || entries.size === 0) return

    let payload: unknown
    try {
      payload = JSON.parse(event.data)
    } catch {
      return
    }

    const message: PushMessage = {
      id: event.lastEventId || undefined,
      type,
      payload,
    }

    for (const entry of entries) {
      try {
        entry.callback(message)
      } catch (error) {
        console.error(`[push] listener error for ${type}`, error)
      }
    }
  }
}

function addBusListener(type: string): void {
  if (state.busListeners.has(type) || !state.eventSource) return
  const listener = createBusListener(type)
  state.busListeners.set(type, listener)
  state.eventSource.addEventListener(type, listener)
}

function removeBusListener(type: string): void {
  const listener = state.busListeners.get(type)
  if (!listener || !state.eventSource) return
  state.eventSource.removeEventListener(type, listener)
  state.busListeners.delete(type)
}

function connect(): void {
  if (state.eventSource) return

  const config = useRuntimeConfig()
  const url = `${config.public.apiUrl as string}/push/sse`
  const eventSource = new EventSource(url, { withCredentials: true })
  state.eventSource = eventSource

  eventSource.onopen = () => {
    state.connected.value = true
  }

  eventSource.onerror = () => {
    state.connected.value = false
  }

  // Re-register any existing listeners on the new connection.
  for (const type of state.listeners.keys()) {
    addBusListener(type)
  }
}

function disconnect(): void {
  for (const [type, listener] of state.busListeners.entries()) {
    state.eventSource?.removeEventListener(type, listener)
  }
  state.busListeners.clear()
  state.eventSource?.close()
  state.eventSource = null
  state.connected.value = false
}

export function usePush() {
  const instanceId = generateInstanceId()
  const unsubscribes: (() => void)[] = []

  function onMessage<T = unknown>(
    type: string | string[],
    callback: (message: PushMessage<T>) => void,
  ): () => void {
    const types = Array.isArray(type) ? type : [type]

    for (const t of types) {
      const entries = state.listeners.get(t) ?? new Set<ListenerEntry>()
      entries.add({ instanceId, callback: callback as (msg: PushMessage) => void })
      state.listeners.set(t, entries)
      addBusListener(t)
    }

    const unsubscribe = (): void => {
      for (const t of types) {
        const entries = state.listeners.get(t)
        if (!entries) continue

        for (const entry of entries) {
          if (entry.instanceId === instanceId && entry.callback === callback) {
            entries.delete(entry)
            break
          }
        }

        if (entries.size === 0) {
          state.listeners.delete(t)
          removeBusListener(t)
        }
      }

      if (state.listeners.size === 0) {
        disconnect()
      }
    }

    unsubscribes.push(unsubscribe)
    return unsubscribe
  }

  onScopeDispose(() => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe()
    }
  })

  return {
    connected: state.connected,
    connect,
    disconnect,
    onMessage,
  }
}
