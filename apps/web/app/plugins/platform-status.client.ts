import type { PlatformStatus } from '#server/utils/platform-status'

export default defineNuxtPlugin(async () => {
  const status = useState<PlatformStatus | null>('platformStatus', () => null)
  try {
    status.value = await $fetch<PlatformStatus>('/api/platform-status')
  } catch {
    // Fail silently; the app continues without a status.
  }
})
