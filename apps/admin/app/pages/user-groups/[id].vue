<script setup lang="ts">
usePageMeta({ title: 'User Group', icon: 'i-lucide-users' })

interface AdminUserGroup {
  id: string
  name: string
  description?: string
}

const route = useRoute()
const router = useRouter()
const api = useApi()

const groupId = computed(() => decodeURIComponent(route.params.id as string))

const group = ref<AdminUserGroup | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')

const state = reactive({
  name: '',
  description: '',
})

async function load() {
  try {
    const loaded = await api.fetch<AdminUserGroup>(`/api/admin/admin-user-groups/${groupId.value}`)
    group.value = loaded
    state.name = loaded.name
    state.description = loaded.description ?? ''
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load group'
  } finally {
    loading.value = false
  }
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    await api.fetch(`/api/admin/admin-user-groups/${groupId.value}`, {
      method: 'PATCH',
      body: {
        name: state.name,
        description: state.description || undefined,
      },
    })
    await router.push('/user-groups')
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to update group'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <UCard title="Edit admin user group" :description="group?.id">
    <div v-if="loading" class="text-gray-500">Loading...</div>

    <UForm v-else :state="state" @submit="save" class="space-y-4 max-w-md">
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
          Save changes
        </UButton>
        <UButton to="/user-groups" color="neutral" variant="outline">
          Cancel
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
