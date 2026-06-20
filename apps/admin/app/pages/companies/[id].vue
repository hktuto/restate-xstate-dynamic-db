<script setup lang="ts">
const route = useRoute()
const id = computed(() => route.params.id)
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Company Detail" icon="i-lucide-building-2">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UCard
        title="Company detail"
        :description="`Placeholder for company ${id}`"
      />
    </template>
  </UDashboardPanel>
</template>
