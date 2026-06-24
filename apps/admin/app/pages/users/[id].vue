<script setup lang="ts">
usePageMeta({ title: 'User Details', icon: 'i-lucide-users' })

interface AdminUserGroup {
  id: string
  name: string
}

interface PlatformUser {
  id: string
  email: string
  groups: AdminUserGroup[]
}

const route = useRoute()
const router = useRouter()
const api = useApi()

const userId = computed(() => decodeURIComponent(route.params.id as string))

const user = ref<PlatformUser | null>(null)
const groups = ref<AdminUserGroup[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')

const state = reactive({
  email: '',
  password: '',
  groupIds: [] as string[],
})

async function load() {
  try {
    const [loadedUser, loadedGroups] = await Promise.all([
      api.fetch<PlatformUser>(`/api/admin/platform-users/${userId.value}`),
      api.fetch<AdminUserGroup[]>('/api/admin/admin-user-groups'),
    ])
    user.value = loadedUser
    groups.value = loadedGroups
    state.email = loadedUser.email
    state.groupIds = loadedUser.groups.map((g) => g.id)
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load user'
  } finally {
    loading.value = false
  }
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    await api.fetch(`/api/admin/platform-users/${userId.value}`, {
      method: 'PATCH',
      body: {
        email: state.email,
        password: state.password || undefined,
        groupIds: state.groupIds,
      },
    })
    await router.push('/users')
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to update user'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <UCard title="Edit admin user" :description="user?.id">
    <div v-if="loading" class="text-gray-500">Loading...</div>

    <UForm v-else :state="state" @submit="save" class="space-y-4 max-w-md">
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="error"
      />

      <UFormField label="Email" name="email" required>
        <UInput
          v-model="state.email"
          type="email"
          placeholder="admin@example.com"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Password" name="password">
        <UInput
          v-model="state.password"
          type="password"
          placeholder="Leave blank to keep current password"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Groups" name="groups">
        <div v-if="!groups.length" class="text-sm text-gray-500">
          No groups available. <NuxtLink to="/user-groups/new" class="text-blue-600 hover:underline">Create one</NuxtLink>.
        </div>
        <div v-else class="space-y-2">
          <label
            v-for="group in groups"
            :key="group.id"
            class="flex items-center gap-2 text-sm"
          >
            <UCheckbox v-model="state.groupIds" :value="group.id" />
            <span>{{ group.name }}</span>
          </label>
        </div>
      </UFormField>

      <div class="flex gap-3">
        <UButton type="submit" :loading="saving">
          Save changes
        </UButton>
        <UButton to="/users" color="neutral" variant="outline">
          Cancel
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
