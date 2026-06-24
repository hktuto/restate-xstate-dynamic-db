<script setup lang="ts">
import type { ActionContext } from '../types'

const props = defineProps<{ context: ActionContext }>()

const { can } = useAdminPermission()
const allowed = ref(false)

onMounted(async () => {
  allowed.value = await can(props.context.resourceType as any, 'edit_info', props.context.record?.id as string | undefined)
})

function open(ctx?: ActionContext) {
  const context = ctx && 'record' in ctx ? ctx : props.context
  if (!context.record?.id) return
  navigateTo(`/user-groups/${context.record.id}`)
}

defineExpose({ open })
</script>

<template>
  <div
    v-if="allowed"
    class="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
    @click="open()"
  >
    <UIcon name="i-lucide-pencil" class="size-4" />
    <span>Edit</span>
  </div>
</template>
