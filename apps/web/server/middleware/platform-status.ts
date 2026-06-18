interface PlatformStatus {
  mode: 'normal' | 'degraded' | 'maintenance'
  message?: string
  checkedAt?: string
}

declare module 'h3' {
  interface H3EventContext {
    platformStatus?: PlatformStatus
  }
}

export default defineEventHandler(async (event) => {
  const path = getRequestPath(event)

  // Don't block API routes or Nuxt internals.
  if (
    path.startsWith('/api/') ||
    path.startsWith('/_nuxt/') ||
    path.startsWith('/__nuxt/') ||
    path.startsWith('/favicon')
  ) {
    return
  }

  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl as string

  let status: PlatformStatus
  try {
    status = await $fetch<PlatformStatus>(`${apiUrl}/api/platform-status`, { timeout: 3000 })
  } catch {
    status = {
      mode: 'maintenance',
      message: 'Platform status endpoint unavailable',
    }
  }

  event.context.platformStatus = status

  if (status.mode === 'maintenance' && path !== '/maintenance') {
    return sendRedirect(event, '/maintenance')
  }
})
