<script setup lang="ts">
const route = useRoute()
const id = computed(() => route.params.id)
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="User Detail" icon="i-lucide-users" />
    </template>

    <template #body>
      <UCard
        title="User detail"
        :description="`Placeholder for user ${id}`"
      />
    </template>
  </UDashboardPanel>
</template>
