<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Restate + XState POC</h1>
    <p class="mb-4 text-gray-700">
      A minimal Nuxt frontend with a fixed <strong>users</strong> table, drag-drop XState workflow editor,
      and Restate workflow triggers.
    </p>
    <div class="flex gap-3">
      <NuxtLink to="/users" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Manage Users</NuxtLink>
      <NuxtLink to="/workflow-designs" class="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900">Workflows</NuxtLink>
      <NuxtLink to="/triggers" class="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900">Triggers</NuxtLink>
    </div>
  </div>
</template>
