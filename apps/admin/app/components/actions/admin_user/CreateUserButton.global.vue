<script setup lang="ts">
import type { ActionContext } from '../types'

const props = defineProps<{ context: ActionContext }>()

const { can } = useAdminPermission()
const allowed = ref(false)

onMounted(async () => {
  allowed.value = await can(props.context.resourceType as any, 'create')
})
</script>

<template>
  <UButton
    v-if="allowed"
    icon="i-lucide-plus"
    label="New user"
    size="sm"
    to="/users/new"
  />
</template>
