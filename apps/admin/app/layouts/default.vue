<script setup lang="ts">
const router = useRouter()
const auth = useState<{ authenticated: boolean } | null>('adminAuth')
const api = useApi()

async function logout() {
  await api.fetch('/api/auth/admin/logout', { method: 'POST' })
  auth.value = { authenticated: false }
  await router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white shadow px-4 py-3">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <NuxtLink to="/" class="font-semibold text-lg">SuperAdmin</NuxtLink>
        <div class="flex items-center gap-4">
          <NuxtLink to="/" class="text-sm text-gray-600 hover:text-gray-900">Dashboard</NuxtLink>
          <NuxtLink to="/workflows" class="text-sm text-gray-600 hover:text-gray-900">Workflows</NuxtLink>
          <NuxtLink to="/triggers" class="text-sm text-gray-600 hover:text-gray-900">Triggers</NuxtLink>
          <NuxtLink to="/health" class="text-sm text-gray-600 hover:text-gray-900">Health</NuxtLink>
          <button
            class="text-sm text-gray-600 hover:text-red-600"
            @click="logout"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
    <main class="max-w-5xl mx-auto p-4">
      <slot />
    </main>
  </div>
</template>
