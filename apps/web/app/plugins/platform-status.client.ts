import type { PlatformStatus } from '~/types/platform-status'

export default defineNuxtPlugin(async () => {
  const status = useState<PlatformStatus | null>('platformStatus', () => null)
  const api = useApi()
  try {
    status.value = (await api.fetch('/api/platform-status')) as PlatformStatus
  } catch {
    // Fail silently; the app continues without a status.
  }
})
