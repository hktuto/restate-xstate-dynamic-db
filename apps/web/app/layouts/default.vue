<script setup lang="ts">
const status = usePlatformStatus()
const session = useCookie('tenant_session')
const api = useApi()
const { connect, disconnect } = usePush()

watch(session, (value) => {
  if (value) {
    connect()
  } else {
    disconnect()
    connect()
  }
}, { immediate: true })

async function logout() {
  await api.fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <div
      v-if="status?.mode === 'degraded'"
      class="bg-yellow-50 border-b border-yellow-200 text-yellow-800 px-4 py-2"
    >
      <div class="max-w-5xl mx-auto text-sm font-medium">
        {{ status.message ?? 'Some features are temporarily unavailable.' }}
      </div>
    </div>
    <nav class="bg-white border-b border-gray-200">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex gap-6">
          <NuxtLink to="/" class="font-semibold hover:text-blue-600">Home</NuxtLink>
          <NuxtLink to="/users" class="hover:text-blue-600">Users</NuxtLink>
          <NuxtLink to="/workflow-designs" class="hover:text-blue-600">Workflows</NuxtLink>
          <NuxtLink to="/triggers" class="hover:text-blue-600">Triggers</NuxtLink>
          <NuxtLink to="/user-tasks" class="hover:text-blue-600">Tasks</NuxtLink>
        </div>
        <div class="flex items-center gap-3">
          <CompanySwitcher />
          <button
            v-if="session"
            class="text-sm text-gray-600 hover:text-red-600"
            @click="logout"
          >
            Logout
          </button>
          <NuxtLink v-else to="/login" class="text-sm text-blue-600 hover:underline">Login</NuxtLink>
        </div>
      </div>
    </nav>
    <main class="max-w-5xl mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
