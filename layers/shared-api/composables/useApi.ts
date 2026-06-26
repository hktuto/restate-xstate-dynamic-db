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
        const body = response?._data as { error?: string } | undefined
        const message = body?.error ?? `API error ${response?.status ?? 'unknown'}`
        context.error = new Error(message)
      },
    }),
  }
}
