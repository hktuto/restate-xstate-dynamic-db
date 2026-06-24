import type { ResourceActionPlacement } from 'shared'

const loaders: Record<string, () => Promise<{ resourceActionPlacements?: Record<string, ResourceActionPlacement[]> }>> = {
  admin_user_group: () => import('../config/resource-actions/admin_user_group'),
}

export function useResourceActionPlacements() {
  return async function loadResourceActionPlacements(
    resource: string,
  ): Promise<Record<string, ResourceActionPlacement[]> | null> {
    const loader = loaders[resource]
    if (!loader) {
      return null
    }
    const module = await loader()
    return module.resourceActionPlacements ?? null
  }
}
