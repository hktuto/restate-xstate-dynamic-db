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
    await api.fetch('/api/admin/login', {
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

      <UFormField label="Email" name="email" class="w-full">
        <UInput
          v-model="state.email"
          type="email"
          placeholder="admin@example.com"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Password" name="password" class="w-full">
        <UInput
          v-model="state.password"
          type="password"
          placeholder="••••••••"
          class="w-full"
        />
      </UFormField>

      <UButton type="submit" block>
        Sign in
      </UButton>
    </UForm>
  </UCard>
</template>
