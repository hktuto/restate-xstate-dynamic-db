import type { MaybeRef } from 'vue'
import type { ResourceType } from 'shared'

export interface ResourceCapabilities {
  resource: string
  canUpdateView: boolean
  canEditSchema: boolean
  canManagePermissions: boolean
}

export function useResourceCapabilities(resource: MaybeRef<ResourceType>) {
  const resourceRef = toRef(resource)
  const { can } = useAdminPermission()

  const canUpdateView = ref(false)
  const canEditSchema = ref(false)
  const canManagePermissions = ref(false)

  async function refresh() {
    const r = resourceRef.value
    canUpdateView.value = await can(r, 'update_default_view_settings')
    canEditSchema.value = await can(r, 'edit_schema')
    canManagePermissions.value = await can(r, 'manage_permissions')
  }

  onMounted(() => refresh())

  const config = computed<ResourceCapabilities>(() => ({
    resource: resourceRef.value,
    canUpdateView: canUpdateView.value,
    canEditSchema: canEditSchema.value,
    canManagePermissions: canManagePermissions.value,
  }))

  return config
}
