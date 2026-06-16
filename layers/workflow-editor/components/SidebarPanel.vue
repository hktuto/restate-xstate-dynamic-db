<script setup lang="ts">
const activeTab = defineModel<'context' | 'details'>('activeTab', { default: 'details' })
const isOpen = defineModel<boolean>('open', { default: true })

function setTab(tab: 'context' | 'details') {
  if (activeTab.value === tab && isOpen.value) {
    isOpen.value = false
  } else {
    activeTab.value = tab
    isOpen.value = true
  }
}
</script>

<template>
  <div class="flex h-full border-l bg-white">
    <div class="flex flex-col border-r bg-gray-50">
      <button
        class="px-3 py-2 text-xs font-medium border-b"
        :class="activeTab === 'context' ? 'bg-white text-blue-600' : 'text-gray-600'"
        @click="setTab('context')"
      >
        Context
      </button>
      <button
        class="px-3 py-2 text-xs font-medium border-b"
        :class="activeTab === 'details' ? 'bg-white text-blue-600' : 'text-gray-600'"
        @click="setTab('details')"
      >
        Details
      </button>
      <div class="flex-1" />
      <button class="px-3 py-2 text-gray-600 hover:bg-gray-200" @click="isOpen = !isOpen">
        {{ isOpen ? '›' : '‹' }}
      </button>
    </div>
    <div v-if="isOpen" class="w-80 overflow-y-auto">
      <slot />
    </div>
  </div>
</template>
