<script setup lang="ts">
import type { ViewDefinition } from 'shared'

const route = useRoute()
const router = useRouter()
const api = useApi()

const nsdb = computed(() => (route.query.nsdb as string) ?? '')
const table = computed(() => (route.query.table as string) ?? '')

const views = ref<ViewDefinition[]>([])
const loading = ref(false)
const error = ref('')

async function refresh() {
  if (!nsdb.value) {
    error.value = 'Missing nsdb query param'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const query = table.value ? `?table=${table.value}` : ''
    views.value = await api.fetch<ViewDefinition[]>(`/api/admin/views/${nsdb.value}${query}`)
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load views'
  } finally {
    loading.value = false
  }
}

async function deleteView(id: string) {
  if (!confirm('Delete this view?')) return
  await api.fetch(`/api/admin/views/${nsdb.value}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  await refresh()
}

await refresh()
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Views" icon="i-lucide-eye" />
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">Views</h1>
          <NuxtLink
            :to="`/views/new${nsdb ? `?nsdb=${nsdb}${table ? `&table=${table}` : ''}` : ''}`"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            New view
          </NuxtLink>
        </div>

        <div v-if="error" class="p-4 text-red-600 bg-red-50 rounded">
          {{ error }}
        </div>
        <div v-else-if="loading" class="text-gray-500">Loading...</div>
        <ul v-else class="bg-white rounded shadow divide-y">
          <li
            v-for="view in views"
            :key="view.id"
            class="p-4 flex items-center justify-between"
          >
            <div>
              <NuxtLink
                :to="`/views/${encodeURIComponent(view.id!)}?nsdb=${nsdb}`"
                class="font-medium hover:text-blue-600"
              >
                {{ view.name }}
              </NuxtLink>
              <div class="text-sm text-gray-500">
                {{ view.table }} {{ view.isDefault ? '· default' : '' }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <NuxtLink
                :to="`/tables/${view.table}?nsdb=${nsdb}&viewId=${encodeURIComponent(view.id!)}`"
                class="text-blue-600 hover:underline text-sm"
              >
                Open
              </NuxtLink>
              <button class="text-red-600 hover:underline text-sm" @click="deleteView(view.id!)">
                Delete
              </button>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </UDashboardPanel>
</template>
