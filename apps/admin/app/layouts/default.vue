<script setup lang="ts">
import type { NavigationMenuItem, DropdownMenuItem } from '@nuxt/ui'

const auth = useAuth()
const colorMode = useColorMode()

const items = ref<NavigationMenuItem[]>([
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  { label: 'Companies', icon: 'i-lucide-building-2', to: '/companies' },
  { label: 'Users', icon: 'i-lucide-users', to: '/users' },
  { label: 'User Groups', icon: 'i-lucide-users-round', to: '/user-groups' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
  { label: 'Workflow Designs', icon: 'i-lucide-workflow', to: '/workflow-designs' },
  { label: 'Views', icon: 'i-lucide-eye', to: '/views' },
  { label: 'Health', icon: 'i-lucide-heart-pulse', to: '/health' },
])

const displayName = computed(() => auth.user.value?.email ?? 'Admin User')
const avatarSeed = computed(() => auth.user.value?.email ?? 'Admin')

const menuItems = computed<DropdownMenuItem[][]>(() => [
  [{
    type: 'label',
    label: displayName.value,
    avatar: {
      src: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(avatarSeed.value)}`,
      alt: displayName.value,
    },
  }],
  [
    { label: 'Profile', icon: 'i-lucide-user', to: '/settings' },
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
  ],
  [{
    label: 'Appearance',
    icon: 'i-lucide-sun-moon',
    children: [
      {
        label: 'Light',
        icon: 'i-lucide-sun',
        type: 'checkbox',
        checked: colorMode.value === 'light',
        onSelect(e: Event) {
          e.preventDefault()
          colorMode.preference = 'light'
        },
      },
      {
        label: 'Dark',
        icon: 'i-lucide-moon',
        type: 'checkbox',
        checked: colorMode.value === 'dark',
        onSelect(e: Event) {
          e.preventDefault()
          colorMode.preference = 'dark'
        },
      },
    ],
  }],
  [{
    label: 'Logout',
    icon: 'i-lucide-log-out',
    onSelect() {
      auth.logout()
    },
  }],
])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/dashboard" class="font-semibold text-lg">
          <span v-if="!collapsed">SuperAdmin</span>
          <UIcon v-else name="i-lucide-shield" class="size-5" />
        </NuxtLink>
      </template>

      <UNavigationMenu orientation="vertical" :items="items" tooltip />

      <template #footer="{ collapsed }">
        <UDropdownMenu
          :items="menuItems"
          :content="{ align: 'center', collisionPadding: 12 }"
          :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
        >
          <UButton
            color="neutral"
            variant="ghost"
            :block="!collapsed"
            :square="collapsed"
            :aria-label="displayName"
            :avatar="{
              src: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(avatarSeed)}`,
              alt: displayName,
            }"
            :label="collapsed ? undefined : displayName"
            :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
            class="data-[state=open]:bg-elevated"
            :ui="{ trailingIcon: 'text-dimmed' }"
          />
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
