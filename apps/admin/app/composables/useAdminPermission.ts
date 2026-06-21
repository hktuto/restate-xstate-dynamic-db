import { useApi } from './useApi'
import { hasAction, type ResourceType } from 'shared'

export function useAdminPermission() {
  const api = useApi()
  const cache = useState<Record<string, string>>('adminPermissions', () => ({}))

  async function can(resourceType: string, action: string, recordId?: string): Promise<boolean> {
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
    return hasAction(mask, resourceType as ResourceType, action as any)
  }

  return { can }
}
