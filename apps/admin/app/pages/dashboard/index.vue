<script setup lang="ts">
usePageMeta({ title: 'Dashboard', icon: 'i-lucide-layout-dashboard' })

interface DashboardStats {
  companies: number
  workflowDesigns: number
  triggers: number
}

const stats = ref<DashboardStats | null>(null)
const api = useApi()

onMounted(async () => {
  stats.value = await api.fetch<DashboardStats>('/api/admin/dashboard')
})
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <NuxtLink to="/companies">
      <UCard title="Companies" description="Manage tenant companies">
        <div class="text-3xl font-bold">{{ stats?.companies ?? 0 }}</div>
      </UCard>
    </NuxtLink>

    <NuxtLink to="/workflow-designs">
      <UCard title="Workflow Designs" description="Platform workflow definitions">
        <div class="text-3xl font-bold">{{ stats?.workflowDesigns ?? 0 }}</div>
      </UCard>
    </NuxtLink>

    <NuxtLink to="/health">
      <UCard title="Platform Triggers" description="Active trigger rules">
        <div class="text-3xl font-bold">{{ stats?.triggers ?? 0 }}</div>
      </UCard>
    </NuxtLink>
  </div>

  <UCard title="Quick actions" description="Common admin tasks">
    <div class="flex flex-wrap gap-3">
      <UButton to="/workflow-designs/new" color="neutral" variant="outline" icon="i-lucide-plus">
        New workflow design
      </UButton>
      <UButton to="/users" color="neutral" variant="ghost" icon="i-lucide-users">
        Manage users
      </UButton>
    </div>
  </UCard>
</template>
