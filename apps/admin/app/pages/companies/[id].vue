<script setup lang="ts">
usePageMeta({ title: 'Company Detail', icon: 'i-lucide-building-2' })

const route = useRoute()
const id = computed(() => route.params.id)
</script>

<template>
  <UCard
    title="Company detail"
    :description="`Placeholder for company ${id}`"
  />
</template>
