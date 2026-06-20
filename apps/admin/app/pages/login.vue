<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const state = reactive({ email: 'admin@example.com', password: 'admin' })
const error = ref('')
const auth = useAuth()

async function login() {
  error.value = ''
  try {
    const ok = await auth.login(state)
    if (!ok) {
      error.value = 'Login failed'
      return
    }
    await navigateTo('/dashboard')
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
