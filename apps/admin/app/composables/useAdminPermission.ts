import { useApi } from './useApi'
import { hasAction, type ResourceType, type PermissionAction } from 'shared'

export function useAdminPermission() {
  const api = useApi()
  const cache = useState<Record<string, string>>('adminPermissions', () => ({}))

  async function can<T extends ResourceType>(
    resourceType: T,
    action: PermissionAction<T>,
    recordId?: string
  ): Promise<boolean> {
    const key = recordId ? `${resourceType}:${recordId}` : resourceType
    let mask = cache.value[key]
    if (mask === undefined) {
      try {
        const result = await api.fetch<{ bitmask: string }>(
          `/api/admin/permissions/effective?resourceType=${encodeURIComponent(resourceType)}${recordId ? `&recordId=${encodeURIComponent(recordId)}` : ''}`
        )
        mask = result.bitmask
        cache.value[key] = mask
      } catch (err) {
        console.error('Failed to load admin permissions:', err)
        return false
      }
    }
    return hasAction(mask, resourceType, action)
  }

  return { can }
}
