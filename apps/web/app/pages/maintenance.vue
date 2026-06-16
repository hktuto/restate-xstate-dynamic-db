<script setup lang="ts">
if (process.server) {
  const event = useRequestEvent()
  if (event) {
    setResponseStatus(event, 503)
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gray-50">
    <div class="max-w-md text-center">
      <h1 class="text-2xl font-semibold text-gray-900">Platform maintenance</h1>
      <p class="mt-2 text-gray-600">We're working on it. Please try again later.</p>
    </div>
  </div>
</template>
