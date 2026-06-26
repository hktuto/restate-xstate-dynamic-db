import { ref, onScopeDispose } from 'vue'

export interface PushMessage<T = unknown> {
  id?: string
  type: string
  payload: T
}

export function usePush() {
  const config = useRuntimeConfig()
  const connected = ref(false)
  let eventSource: EventSource | null = null

  function connect() {
    if (eventSource) return

    const url = `${config.public.apiUrl as string}/push/sse`
    eventSource = new EventSource(url, { withCredentials: true })

    eventSource.onopen = () => {
      connected.value = true
    }

    eventSource.onerror = () => {
      connected.value = false
    }
  }

  function disconnect() {
    eventSource?.close()
    eventSource = null
    connected.value = false
  }

  function onMessage<T = unknown>(type: string, handler: (message: PushMessage<T>) => void) {
    connect()

    const es = eventSource
    if (!es) return () => {}

    const listener = (event: MessageEvent) => {
      let payload: T
      try {
        payload = JSON.parse(event.data) as T
      } catch {
        return
      }

      handler({
        id: event.lastEventId || undefined,
        type: event.type,
        payload,
      })
    }

    es.addEventListener(type, listener)

    return () => {
      es.removeEventListener(type, listener)
    }
  }

  onScopeDispose(disconnect)

  return {
    connected,
    connect,
    disconnect,
    onMessage,
  }
}
