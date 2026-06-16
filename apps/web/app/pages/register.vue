<script setup lang="ts">
const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()

async function submit() {
  error.value = ''
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { name: name.value, email: email.value, password: password.value }
    })
    await router.push('/companies')
  } catch (e: any) {
    error.value = e.statusMessage || 'Registration failed'
  }
}
</script>

<template>
  <div class="max-w-md mx-auto bg-white p-6 rounded shadow">
    <h1 class="text-xl font-semibold mb-4">Register</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="block text-sm font-medium">Name</label>
        <input v-model="name" class="border rounded px-3 py-2 w-full" required />
      </div>
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
        Register
      </button>
      <p class="text-sm text-center">
        Already have an account? <NuxtLink to="/login" class="text-blue-600 hover:underline">Log in</NuxtLink>
      </p>
    </form>
  </div>
</template>
