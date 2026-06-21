export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null
}

export function useApi() {
  const config = useRuntimeConfig()
  const baseUrl = config.public.apiUrl as string
  return {
    async fetch<T = unknown>(path: string, init?: ApiFetchOptions): Promise<T> {
      const body = init?.body
      const serializedBody =
        body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)
          ? JSON.stringify(body)
          : body
      const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        credentials: 'include',
        body: serializedBody,
        headers: {
          ...(init?.headers ?? {}),
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 401 && import.meta.client) {
          await navigateTo('/login')
        }
        throw new Error(body.error ?? `API error ${res.status}`)
      }
      return res.json() as Promise<T>
    },
  }
}
