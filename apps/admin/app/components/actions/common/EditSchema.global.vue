<script setup lang="ts">
import type { ActionContext, PermissionAction, ResourceType } from 'shared'

const props = defineProps<{ context: ActionContext }>()

const { can } = useAdminPermission()
const allowed = ref(false)

onMounted(async () => {
  allowed.value = await can(
    props.context.resourceType as ResourceType,
    'edit_schema' as PermissionAction<ResourceType>
  )
})
</script>

<template>
  <UButton
    v-if="allowed"
    icon="i-lucide-table-2"
    label="Edit schema"
    size="sm"
    color="neutral"
    :to="`/schema/${encodeURIComponent(props.context.table)}?nsdb=${encodeURIComponent(props.context.nsdb)}`"
  />
</template>
