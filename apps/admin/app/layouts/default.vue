<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const api = useApi()
const router = useRouter()
const auth = useState<{ authenticated: boolean } | null>('adminAuth')

const items = ref<NavigationMenuItem[]>([
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: 'Companies', icon: 'i-lucide-building-2', to: '/companies' },
  { label: 'Users', icon: 'i-lucide-users', to: '/users' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
  { label: 'Workflow Designs', icon: 'i-lucide-workflow', to: '/workflow-designs' },
  { label: 'Health', icon: 'i-lucide-heart-pulse', to: '/health' },
])

async function logout() {
  await api.fetch('/api/admin/logout', { method: 'POST' })
  auth.value = { authenticated: false }
  await router.push('/login')
}
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar collapsible>
      <template #header="{ collapsed }">
        <div class="flex items-center justify-between w-full">
          <NuxtLink to="/dashboard" class="font-semibold text-lg">
            SuperAdmin
          </NuxtLink>

          <UDashboardSidebarCollapse variant="subtle" />
        </div>
      </template>

      <UNavigationMenu orientation="vertical" :items="items" />

      <template #footer="{ collapsed }">
        <UPopover>
          <UButton
            color="neutral"
            variant="ghost"
            :block="!collapsed"
            :square="collapsed"
            :avatar="{
              src: 'https://api.dicebear.com/9.x/initials/svg?seed=Admin',
            }"
            :label="collapsed ? undefined : 'Admin User'"
            :trailing-icon="collapsed ? undefined : 'i-lucide-chevron-up'"
          />

          <template #content>
            <div class="flex flex-col gap-1 p-2 w-48">
              <UButton
                to="/settings"
                variant="ghost"
                color="neutral"
                icon="i-lucide-user"
                class="justify-start"
              >
                Profile
              </UButton>

              <UButton
                to="/settings"
                variant="ghost"
                color="neutral"
                icon="i-lucide-settings"
                class="justify-start"
              >
                Settings
              </UButton>

              <USeparator />

              <UButton
                variant="ghost"
                color="neutral"
                icon="i-lucide-log-out"
                class="justify-start"
                @click="logout"
              >
                Logout
              </UButton>
            </div>
          </template>
        </UPopover>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
