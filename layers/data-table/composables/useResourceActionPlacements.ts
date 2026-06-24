import type { ResourceActionPlacement } from 'shared'

export function useResourceActionPlacements() {
  return async function loadResourceActionPlacements(
    _resource: string,
  ): Promise<Record<string, ResourceActionPlacement[]> | null> {
    throw new Error('useResourceActionPlacements must be provided by the host app. Create apps/<app>/composables/useResourceActionPlacements.ts to override this layer default.')
  }
}
