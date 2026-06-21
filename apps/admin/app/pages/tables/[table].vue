<script setup lang="ts">
const route = useRoute()
const { can } = useAdminPermission()

const tableName = computed(() => route.params.table as string)
const nsdb = computed(() => (route.query.nsdb as string) || 'platform--admin')

const resourceType = computed(() => {
  const map: Record<string, string> = {
    companies: 'company',
    admin_users: 'admin_user',
    admin_user_groups: 'admin_user_group',
    workflow_designs: 'workflow_design',
  }
  return map[tableName.value]
})

const canUpdateView = ref(false)
const canEditSchema = ref(false)
const canManagePermissions = ref(false)

onMounted(async () => {
  const rt = resourceType.value
  if (!rt) return
  canUpdateView.value = await can(rt as any, 'update_default_view_settings' as any)
  canEditSchema.value = await can(rt as any, 'edit_schema' as any)
  canManagePermissions.value = await can(rt as any, 'manage_permissions' as any)
})
</script>

<template>
  <DataTablePage
    :title="tableName"
    icon="i-lucide-table"
    :table="tableName"
    :nsdb="nsdb"
    :can-update-view="canUpdateView"
    :can-edit-schema="canEditSchema"
    :can-manage-permissions="canManagePermissions"
  />
</template>
