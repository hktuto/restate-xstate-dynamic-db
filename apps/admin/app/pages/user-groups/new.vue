<script setup lang="ts">
usePageMeta({ title: 'New Group', icon: 'i-lucide-users-round' })

const api = useApi()
const router = useRouter()

const state = reactive({
  name: '',
  description: '',
})

const saving = ref(false)
const error = ref('')

async function save() {
  error.value = ''
  saving.value = true
  try {
    await api.fetch('/api/admin/admin-user-groups', {
      method: 'POST',
      body: {
        name: state.name,
        description: state.description || undefined,
      },
    })
    await router.push('/user-groups')
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to create group'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard title="Create admin user group" description="Group platform administrators together.">
    <UForm :state="state" @submit="save" class="space-y-4 max-w-md">
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="error"
      />

      <UFormField label="Name" name="name" required>
        <UInput
          v-model="state.name"
          placeholder="Support Admins"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Description" name="description">
        <UInput
          v-model="state.description"
          placeholder="Short description"
          class="w-full"
        />
      </UFormField>

      <div class="flex gap-3">
        <UButton type="submit" :loading="saving">
          Create group
        </UButton>
        <UButton to="/user-groups" color="neutral" variant="outline">
          Cancel
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
