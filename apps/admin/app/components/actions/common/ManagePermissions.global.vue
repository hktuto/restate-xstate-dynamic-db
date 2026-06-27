<script setup lang="ts">
import type { ActionContext, PermissionAction, ResourceType } from 'shared'

const props = defineProps<{ context: ActionContext }>()

const { can } = useAdminPermission()
const allowed = ref(false)

onMounted(async () => {
  allowed.value = await can(
    props.context.resourceType as ResourceType,
    'manage_permissions' as PermissionAction<ResourceType>
  )
})
</script>

<template>
  <UButton
    v-if="allowed"
    icon="i-lucide-shield"
    label="Manage permissions"
    size="sm"
    color="neutral"
    :to="`/permissions/${encodeURIComponent(props.context.table)}?nsdb=${encodeURIComponent(props.context.nsdb)}`"
  />
</template>
