<script setup lang="ts">
const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()

async function submit() {
  error.value = ''
  try {
    const result = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    if (result.companies.length === 0) {
      await router.push('/companies')
    } else {
      const company = result.companies[0]!
      const companyCookie = useCookie('company')
      companyCookie.value = JSON.stringify({ id: company.id, slug: company.slug, namespace: company.namespace })
      await router.push('/')
    }
  } catch (e: any) {
    error.value = e.statusMessage || 'Login failed'
  }
}
</script>

<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
    <h1 class="text-xl font-semibold mb-4">Log in</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium">Email</label>
        <input v-model="email" type="email" class="border rounded px-3 py-2 w-full" required />
      </div>
      <div>
        <label class="block text-sm font-medium">Password</label>
        <input v-model="password" type="password" class="border rounded px-3 py-2 w-full" required />
      </div>
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full">
        Log in
      </button>
      <p class="text-sm text-center">
        No account? <NuxtLink to="/register" class="text-blue-600 hover:underline">Register</NuxtLink>
      </p>
    </form>
  </div>
</template>
