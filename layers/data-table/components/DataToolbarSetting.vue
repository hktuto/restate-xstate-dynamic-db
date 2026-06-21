<script setup lang="ts">
interface Props {
  canEditSchema?: boolean
  canManagePermissions?: boolean
  schemaEditLink?: string
  permissionsEditLink?: string
}

const props = defineProps<Props>()
</script>

<template>
  <UDropdownMenu
    v-if="canEditSchema || canManagePermissions"
    :items="[
      ...(canEditSchema && schemaEditLink ? [{ label: 'Edit schema', to: schemaEditLink, icon: 'i-lucide-table-2' }] : []),
      ...(canManagePermissions && permissionsEditLink ? [{ label: 'Manage permissions', to: permissionsEditLink, icon: 'i-lucide-shield' }] : []),
    ]"
  >
    <UButton color="neutral" size="sm" icon="i-lucide-settings" trailing-icon="i-lucide-chevron-down">
      Settings
    </UButton>
  </UDropdownMenu>
</template>
