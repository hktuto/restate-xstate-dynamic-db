# Admin UI Dashboard Layout and Login Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin `apps/admin` with a Nuxt UI v4 dashboard layout, sidebar navigation, rebuilt login page, and placeholder pages for Companies/Users/Settings.

**Architecture:** The default layout wraps pages in `UDashboardGroup` + `UDashboardSidebar`; pages provide their own `UDashboardPanel` and `UDashboardNavbar`. The login page uses a standalone centered `UCard` in the public `auth` layout.

**Tech Stack:** Nuxt 4, Nuxt UI v4, Vue 3, TypeScript.

---

### Task 1: Replace the default layout with a Nuxt UI dashboard sidebar

**Files:**
- Modify: `apps/admin/app/layouts/default.vue`

- [ ] **Step 1: Replace `default.vue` with the dashboard layout**

```vue
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
  await api.fetch('/api/auth/admin/logout', { method: 'POST' })
  auth.value = { authenticated: false }
  await router.push('/login')
}
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar collapsible>
      <template #header>
        <NuxtLink to="/dashboard" class="font-semibold text-lg">
          SuperAdmin
        </NuxtLink>
      </template>

      <UNavigationMenu orientation="vertical" :items="items" />

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-out"
          block
          @click="logout"
        >
          Logout
        </UButton>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
```

- [ ] **Step 2: Typecheck the admin app**

Run: `pnpm --filter admin typecheck`
Expected: passes.

---

### Task 2: Rewrite the login page with Nuxt UI form components

**Files:**
- Modify: `apps/admin/app/pages/login.vue`

- [ ] **Step 1: Replace `login.vue` with the Nuxt UI login form**

```vue
<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const state = reactive({ email: 'admin@example.com', password: 'admin' })
const error = ref('')
const router = useRouter()
const auth = useState<{ authenticated: boolean } | null>('adminAuth')
const api = useApi()

async function login() {
  error.value = ''
  try {
    await api.fetch('/api/auth/admin/login', {
      method: 'POST',
      body: state,
    })
    auth.value = { authenticated: true }
    await router.push('/dashboard')
  } catch (e: any) {
    error.value = e.message || 'Login failed'
  }
}
</script>

<template>
  <UCard
    class="w-full max-w-sm"
    title="Sign in"
    description="Enter your credentials to access the admin dashboard."
  >
    <UForm :state="state" @submit="login" class="space-y-4">
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :title="error"
      />

      <UFormField label="Email" name="email">
        <UInput
          v-model="state.email"
          type="email"
          placeholder="admin@example.com"
        />
      </UFormField>

      <UFormField label="Password" name="password">
        <UInput
          v-model="state.password"
          type="password"
          placeholder="••••••••"
        />
      </UFormField>

      <UButton type="submit" block>
        Sign in
      </UButton>
    </UForm>
  </UCard>
</template>
```

- [ ] **Step 2: Typecheck the admin app**

Run: `pnpm --filter admin typecheck`
Expected: passes.

---

### Task 3: Move the dashboard to `/dashboard` and redirect `/`

**Files:**
- Create: `apps/admin/app/pages/dashboard/index.vue`
- Modify: `apps/admin/app/pages/index.vue`

- [ ] **Step 1: Create `apps/admin/app/pages/dashboard/index.vue`**

```vue
<script setup lang="ts">
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
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Dashboard" icon="i-lucide-layout-dashboard" />
    </template>

    <template #body>
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
          <UButton to="/companies/new" icon="i-lucide-plus">
            Create company
          </UButton>
          <UButton to="/workflow-designs/new" color="neutral" variant="outline" icon="i-lucide-plus">
            New workflow design
          </UButton>
          <UButton to="/users" color="neutral" variant="ghost" icon="i-lucide-users">
            Manage users
          </UButton>
        </div>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
```

- [ ] **Step 2: Replace `apps/admin/app/pages/index.vue` with a redirect**

```vue
<script setup lang="ts">
await navigateTo('/dashboard', { replace: true })
</script>
```

- [ ] **Step 3: Typecheck the admin app**

Run: `pnpm --filter admin typecheck`
Expected: passes.

---

### Task 4: Create placeholder pages for Companies, Users, and Settings

**Files:**
- Create: `apps/admin/app/pages/companies/index.vue`
- Create: `apps/admin/app/pages/companies/[id].vue`
- Create: `apps/admin/app/pages/users/index.vue`
- Create: `apps/admin/app/pages/users/[id].vue`
- Create: `apps/admin/app/pages/settings/index.vue`

- [ ] **Step 1: Create `apps/admin/app/pages/companies/index.vue`**

```vue
<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Companies" icon="i-lucide-building-2" />
    </template>

    <template #body>
      <UCard
        title="Companies"
        description="Company management will be implemented here."
      />
    </template>
  </UDashboardPanel>
</template>
```

- [ ] **Step 2: Create `apps/admin/app/pages/companies/[id].vue`**

```vue
<script setup lang="ts">
const route = useRoute()
const id = computed(() => route.params.id)
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Company Detail" icon="i-lucide-building-2" />
    </template>

    <template #body>
      <UCard
        title="Company detail"
        :description="`Placeholder for company ${id}`"
      />
    </template>
  </UDashboardPanel>
</template>
```

- [ ] **Step 3: Create `apps/admin/app/pages/users/index.vue`**

```vue
<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Users" icon="i-lucide-users" />
    </template>

    <template #body>
      <UCard
        title="Users"
        description="User management will be implemented here."
      />
    </template>
  </UDashboardPanel>
</template>
```

- [ ] **Step 4: Create `apps/admin/app/pages/users/[id].vue`**

```vue
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
```

- [ ] **Step 5: Create `apps/admin/app/pages/settings/index.vue`**

```vue
<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Settings" icon="i-lucide-settings" />
    </template>

    <template #body>
      <UCard
        title="Settings"
        description="Application settings will be implemented here."
      />
    </template>
  </UDashboardPanel>
</template>
```

- [ ] **Step 6: Typecheck the admin app**

Run: `pnpm --filter admin typecheck`
Expected: passes.

---

### Task 5: Remove the Triggers page

**Files:**
- Delete: `apps/admin/app/pages/triggers/index.vue`
- Delete: `apps/admin/app/pages/triggers/` directory

- [ ] **Step 1: Delete the triggers directory**

Run:
```bash
rm -rf apps/admin/app/pages/triggers
```

- [ ] **Step 2: Typecheck the admin app**

Run: `pnpm --filter admin typecheck`
Expected: passes.

---

### Task 6: Update existing pages to use the dashboard layout

**Files:**
- Modify: `apps/admin/app/pages/workflow-designs/index.vue`
- Modify: `apps/admin/app/pages/workflow-designs/new.vue`
- Modify: `apps/admin/app/pages/workflow-designs/[id].vue`
- Modify: `apps/admin/app/pages/health.vue`

- [ ] **Step 1: Wrap existing pages in `UDashboardPanel` with a navbar**

For each of the files above, wrap the existing content in:

```vue
<UDashboardPanel>
  <template #header>
    <UDashboardNavbar title="<Page Title>" icon="i-lucide-<icon>" />
  </template>

  <template #body>
    <!-- existing page content -->
  </template>
</UDashboardPanel>
```

Use these titles/icons:
- `workflow-designs/index.vue`: "Workflow Designs" / `i-lucide-workflow`
- `workflow-designs/new.vue`: "New Workflow Design" / `i-lucide-workflow`
- `workflow-designs/[id].vue`: "Workflow Design" / `i-lucide-workflow`
- `health.vue`: "Health" / `i-lucide-heart-pulse`

Keep all existing logic and data fetching; only change the root template wrapper.

- [ ] **Step 2: Typecheck the admin app**

Run: `pnpm --filter admin typecheck`
Expected: passes.

---

### Task 7: Manual verification

**Files:** none

- [ ] **Step 1: Start the dev server**

Run: `pnpm --filter admin dev`

- [ ] **Step 2: Verify in browser**

- `/` redirects to `/dashboard`.
- Sidebar shows six items: Dashboard, Companies, Users, Settings, Workflow Designs, Health.
- Sidebar can be collapsed/expanded.
- `/login` shows the Nuxt UI login card and sign-in works (if backend is running).
- `/companies`, `/companies/1`, `/users`, `/users/1`, `/settings` show placeholder cards.
- `/triggers` returns a 404.
- Unauthenticated access to `/dashboard` redirects to `/login`.

---

## Self-review checklist

- Spec coverage:
  - Dashboard layout → Task 1.
  - Sidebar nav (six items, top-level) → Task 1.
  - `/dashboard` route + `/` redirect → Task 3.
  - Login page with Nuxt UI → Task 2.
  - Placeholder pages for Companies/Users/Settings → Task 4.
  - Triggers removed → Task 5.
  - Existing pages wrapped in dashboard panel → Task 6.
- Placeholder scan: no TBD/TODO; all code is provided.
- Type consistency: route paths and component names match Nuxt UI v4 docs.
