import type { PlatformStatus } from '#server/utils/platform-status'

export function usePlatformStatus(): PlatformStatus | null {
  const event = useRequestEvent()
  if (event) {
    return event.context.platformStatus ?? null
  }
  return useState<PlatformStatus | null>('platformStatus', () => null).value
}
