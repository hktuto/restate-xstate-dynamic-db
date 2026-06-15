<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <nav class="bg-white border-b border-gray-200">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex gap-6">
          <NuxtLink to="/" class="font-semibold hover:text-blue-600">Home</NuxtLink>
          <NuxtLink to="/users" class="hover:text-blue-600">Users</NuxtLink>
          <NuxtLink to="/workflows" class="hover:text-blue-600">Workflows</NuxtLink>
          <NuxtLink to="/triggers" class="hover:text-blue-600">Triggers</NuxtLink>
          <NuxtLink to="/approvals" class="hover:text-blue-600">Approvals</NuxtLink>
        </div>
        <CompanySwitcher />
      </div>
    </nav>
    <main class="max-w-5xl mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
