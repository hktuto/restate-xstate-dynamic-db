<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const route = useRoute()
const { healthMonitorUrl } = useRuntimeConfig().public

const redirect = computed(() => {
  const raw = route.query.redirect
  if (typeof raw !== 'string') return '/dashboard'
  try {
    const url = new URL(raw)
    if (url.pathname === '/maintenance') return '/dashboard'
    return raw
  } catch {
    return '/dashboard'
  }
})

const statusUrl = computed(() => {
  if (!healthMonitorUrl) return ''
  return `${healthMonitorUrl}/status`
})

function goBack() {
  window.location.href = redirect.value
}
</script>

<template>
  <UCard class="w-full max-w-sm text-center">
    <div class="flex flex-col items-center gap-4">
      <UIcon
        name="i-lucide-construction"
        class="text-amber-500 w-12 h-12"
      />
      <div>
        <h1 class="text-lg font-semibold">
          Service temporarily unavailable
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          The platform is experiencing issues. You can go back or check the system status.
        </p>
      </div>
      <div class="flex flex-col gap-2 w-full">
        <UButton block color="primary" @click="goBack">
          Go back
        </UButton>
        <UButton
          v-if="healthMonitorUrl"
          block
          color="neutral"
          variant="outline"
          :to="statusUrl"
          target="_blank"
        >
          Check system status
        </UButton>
      </div>
    </div>
  </UCard>
</template>
