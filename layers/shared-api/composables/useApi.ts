export function useApi() {
  const config = useRuntimeConfig()
  return {
    fetch: $fetch.create({
      baseURL: config.public.apiUrl as string,
      credentials: 'include',
      onResponseError(context) {
        const { response } = context
        if (response?.status === 401 && import.meta.client) {
          const authenticated = useState<boolean>('adminAuthenticated', () => false)
          const user = useState<any>('adminUser', () => null)
          authenticated.value = false
          user.value = null
          navigateTo('/login')
        }
        if (response?.status && response.status >= 500 && response.status <= 599) {
          // 5xx errors may leave the app in a broken state; force a full page reload
          // to the maintenance page rather than a client-side navigation.
          if (import.meta.client && !window.location.pathname.startsWith('/maintenance')) {
            window.location.href = '/maintenance?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)
            return
          }
        }
        const body = response?._data as { error?: string } | undefined
        const message = body?.error ?? `API error ${response?.status ?? 'unknown'}`
        context.error = new Error(message)
      },
    }),
  }
}
