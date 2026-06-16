import { getPlatformStatus, type PlatformStatus } from '#server/utils/platform-status'

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

  const status = await getPlatformStatus()
  event.context.platformStatus = status

  if (status.mode === 'maintenance' && path !== '/maintenance') {
    return sendRedirect(event, '/maintenance')
  }
})
