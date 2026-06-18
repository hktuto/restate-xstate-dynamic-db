<script setup lang="ts">
const checking = ref(false)
const message = ref('')
const api = useApi()

async function recheck() {
  checking.value = true
  message.value = ''
  try {
    const status = await api.fetch<{ mode: string; message?: string }>('/api/platform-status')
    if (status.mode !== 'maintenance') {
      await navigateTo('/')
      return
    }
    message.value = status.message || 'Platform is still in maintenance mode.'
  } catch (err) {
    message.value = 'Could not reach the status API. Please try again later.'
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gray-50">
    <div class="max-w-md text-center">
      <h1 class="text-2xl font-semibold text-gray-900">Platform maintenance</h1>
      <p class="mt-2 text-gray-600">We're working on it. Please try again later.</p>
      <button
        class="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="checking"
        @click="recheck"
      >
        {{ checking ? 'Checking...' : 'Recheck status' }}
      </button>
      <p v-if="message" class="mt-4 text-sm text-gray-700">
        {{ message }}
      </p>
    </div>
  </div>
</template>
