import type { PlatformStatus } from '#server/utils/platform-status'

export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/api/') || to.path === '/maintenance') {
    return
  }

  let status: PlatformStatus | null = null
  if (process.server) {
    const event = useRequestEvent()
    status = event?.context.platformStatus ?? null
  } else {
    status = useState<PlatformStatus | null>('platformStatus').value
  }

  if (status?.mode === 'maintenance') {
    return navigateTo('/maintenance')
  }
})
