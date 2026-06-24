<script setup lang="ts">
import type { ActionContext } from '../types'

const props = defineProps<{ context: ActionContext }>()

const { can } = useAdminPermission()
const allowed = ref(false)
const loading = ref(false)

onMounted(async () => {
  allowed.value = await can(props.context.resourceType as any, 'delete', props.context.record?.id as string | undefined)
})

async function open() {
  if (!props.context.record?.id) return
  const confirmed = confirm('Are you sure you want to delete this group?')
  if (!confirmed) return

  loading.value = true
  try {
    const api = useApi()
    await api.fetch(`/api/admin/admin-user-groups/${props.context.record.id}`, { method: 'DELETE' })
    props.context.refresh?.()
  } catch (err: any) {
    alert(err?.message ?? 'Failed to delete group')
  } finally {
    loading.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <div
    v-if="allowed"
    class="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
    @click="open"
  >
    <UIcon name="i-lucide-trash" class="size-4" />
    <span>Delete</span>
  </div>
</template>
