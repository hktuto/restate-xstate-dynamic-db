<script setup lang="ts">
interface AdminUserGroup {
  id: string
  name: string
}

const api = useApi()
const router = useRouter()

const state = reactive({
  email: '',
  password: '',
  groupIds: [] as string[],
})

const groups = ref<AdminUserGroup[]>([])
const loadingGroups = ref(true)
const saving = ref(false)
const error = ref('')

async function loadGroups() {
  try {
    groups.value = await api.fetch<AdminUserGroup[]>('/api/admin/admin-user-groups')
  } finally {
    loadingGroups.value = false
  }
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    await api.fetch('/api/admin/platform-users', {
      method: 'POST',
      body: {
        email: state.email,
        password: state.password,
        groupIds: state.groupIds,
      },
    })
    await router.push('/users')
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to create user'
  } finally {
    saving.value = false
  }
}

onMounted(loadGroups)
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="New User" icon="i-lucide-users">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UCard title="Create admin user" description="Add a new platform administrator.">
        <UForm :state="state" @submit="save" class="space-y-4 max-w-md">
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

          <UFormField label="Password" name="password" required>
            <UInput
              v-model="state.password"
              type="password"
              placeholder="••••••••"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Groups" name="groups">
            <div v-if="loadingGroups" class="text-sm text-gray-500">Loading groups...</div>
            <div v-else-if="!groups.length" class="text-sm text-gray-500">
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
              Create user
            </UButton>
            <UButton to="/users" color="neutral" variant="outline">
              Cancel
            </UButton>
          </div>
        </UForm>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
