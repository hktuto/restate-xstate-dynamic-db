<script setup lang="ts">
interface AdminUserGroup {
  id: string
  name: string
  description?: string
  updatedAt: string
}

const api = useApi()
const groups = ref<AdminUserGroup[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    groups.value = await api.fetch<AdminUserGroup[]>('/api/admin/admin-user-groups')
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load groups'
  } finally {
    loading.value = false
  }
}

async function remove(id: string) {
  if (!confirm('Delete this group?')) return
  try {
    await api.fetch(`/api/admin/admin-user-groups/${id}`, { method: 'DELETE' })
    await load()
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to delete group'
  }
}

onMounted(load)
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="User Groups" icon="i-lucide-users-round">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton to="/user-groups/new" icon="i-lucide-plus">
            Add group
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UCard title="Admin user groups" description="Groups used to organize platform administrators.">
        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          :title="error"
          class="mb-4"
        />

        <div v-if="loading" class="text-gray-500">Loading...</div>

        <div v-else-if="!groups.length" class="text-gray-500">
          No groups found.
        </div>

        <table v-else class="w-full text-left text-sm">
          <thead class="border-b">
            <tr>
              <th class="py-2">Name</th>
              <th class="py-2">Description</th>
              <th class="py-2">Updated</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="group in groups" :key="group.id" class="border-b last:border-b-0">
              <td class="py-3">{{ group.name }}</td>
              <td class="py-3 text-gray-500">{{ group.description || '—' }}</td>
              <td class="py-3 text-gray-500">
                {{ new Date(group.updatedAt).toLocaleString() }}
              </td>
              <td class="py-3 text-right">
                <UButton
                  :to="`/user-groups/${encodeURIComponent(group.id)}`"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-pencil"
                  class="mr-1"
                />
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash"
                  @click="remove(group.id)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
