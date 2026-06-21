import { useApi } from './useApi'

export function useAdminPermission() {
  const api = useApi()
  const cache = useState<Record<string, string>>('adminPermissions', () => ({}))

  async function can(resourceType: string, action: string, recordId?: string): Promise<boolean> {
    const key = recordId ? `${resourceType}:${recordId}` : resourceType
    if (cache.value[key] !== undefined) {
      return hasBit(cache.value[key]!, action)
    }
    try {
      const result = await api.fetch<{ bitmask: string }>(
        `/api/admin/permissions/effective?resourceType=${encodeURIComponent(resourceType)}${recordId ? `&recordId=${encodeURIComponent(recordId)}` : ''}`
      )
      cache.value[key] = result.bitmask
      return hasBit(result.bitmask, action)
    } catch {
      return false
    }
  }

  return { can }
}

function hasBit(bitmask: string, action: string): boolean {
  // The admin UI only needs coarse action checks for now.
  // The API already enforces the real compound check.
  return (Number(bitmask) & actionValue(action)) !== 0
}

function actionValue(action: string): number {
  switch (action) {
    case 'view':
      return 1
    case 'create':
      return 5
    case 'edit':
    case 'edit_info':
      return 3
    case 'delete':
      return 9
    case 'manage_permissions':
      return 512
    default:
      return 0
  }
}
