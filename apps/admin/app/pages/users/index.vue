<script setup lang="ts">
interface AdminUserGroup {
  id: string
  name: string
}

interface PlatformUser {
  id: string
  email: string
  createdAt: string
  updatedAt: string
  groups: AdminUserGroup[]
}

const api = useApi()
const { can } = useAdminPermission()
const users = ref<PlatformUser[]>([])
const loading = ref(true)
const error = ref('')
const canCreate = ref(false)
const canDelete = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    users.value = await api.fetch<PlatformUser[]>('/api/admin/platform-users')
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load users'
  } finally {
    loading.value = false
  }
}

async function remove(id: string) {
  if (!confirm('Delete this admin user?')) return
  try {
    await api.fetch(`/api/admin/platform-users/${id}`, { method: 'DELETE' })
    await load()
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to delete user'
  }
}

onMounted(async () => {
  canCreate.value = await can('admin_user', 'create')
  canDelete.value = await can('admin_user', 'delete')
  await load()
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Users" icon="i-lucide-users">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton v-if="canCreate" to="/users/new" icon="i-lucide-plus">
            Add user
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UCard title="Admin users" description="Manage platform administrator accounts and their groups.">
        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          :title="error"
          class="mb-4"
        />

        <div v-if="loading" class="text-gray-500">Loading...</div>

        <div v-else-if="!users.length" class="text-gray-500">
          No admin users found.
        </div>

        <table v-else class="w-full text-left text-sm">
          <thead class="border-b">
            <tr>
              <th class="py-2">Email</th>
              <th class="py-2">Groups</th>
              <th class="py-2">Updated</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id" class="border-b last:border-b-0">
              <td class="py-3">{{ user.email }}</td>
              <td class="py-3">
                <span v-if="!user.groups.length" class="text-gray-400">—</span>
                <span
                  v-for="group in user.groups"
                  :key="group.id"
                  class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 mr-1"
                >
                  {{ group.name }}
                </span>
              </td>
              <td class="py-3 text-gray-500">
                {{ new Date(user.updatedAt).toLocaleString() }}
              </td>
              <td class="py-3 text-right">
                <UButton
                  :to="`/users/${encodeURIComponent(user.id)}`"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-pencil"
                  class="mr-1"
                />
                <UButton
                  v-if="canDelete"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash"
                  @click="remove(user.id)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
