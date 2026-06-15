<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'

interface UserProfile {
  id: string
  name: string
}

interface Member {
  id: string
  email: string
  role: 'owner' | 'admin' | 'member'
  status: 'pending' | 'active' | 'inactive'
  profile: UserProfile | null
}

const { data: members, refresh, pending, error: fetchError } = await useFetch<Member[]>('/api/users')

const invite = reactive<{ email: string; role: Member['role'] }>({
  email: '',
  role: 'member'
})

const roleItems: { label: string; value: Member['role'] }[] = [
  { label: 'Owner', value: 'owner' },
  { label: 'Admin', value: 'admin' },
  { label: 'Member', value: 'member' }
]

const error = ref<string | null>(null)
const submitting = ref(false)

async function inviteMember() {
  error.value = null
  submitting.value = true

  try {
    await $fetch('/api/users', {
      method: 'POST',
      body: {
        email: invite.email,
        role: invite.role
      }
    })
    invite.email = ''
    invite.role = 'member'
    // eslint-disable-next-line no-console
    console.log('Member invited successfully')
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to invite member'
  } finally {
    submitting.value = false
  }
}

const UBadge = resolveComponent('UBadge')

const columns: TableColumn<Member>[] = [
  {
    accessorKey: 'email',
    header: 'Email'
  },
  {
    accessorKey: 'role',
    header: 'Role'
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as Member['status']
      if (status === 'pending') {
        return h(UBadge, { color: 'warning', variant: 'soft' }, () => 'Pending')
      }
      return status
    }
  },
  {
    accessorKey: 'profile',
    header: 'Name',
    cell: ({ row }) => {
      const profile = row.getValue('profile') as Member['profile']
      return profile?.name ?? '-'
    }
  }
]
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Members</h1>

    <UForm :state="invite" class="bg-white p-4 rounded shadow mb-6 space-y-3" @submit="inviteMember">
      <h2 class="font-semibold">Invite member</h2>
      <div class="grid grid-cols-2 gap-3">
        <UInput v-model="invite.email" type="email" placeholder="Email" required />
        <USelect v-model="invite.role" :items="roleItems" placeholder="Select role" required />
      </div>
      <UButton type="submit" color="primary" label="Invite" :disabled="submitting" :loading="submitting" />
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
    </UForm>

    <div v-if="pending" class="text-sm text-gray-500">Loading members...</div>
    <div v-else-if="fetchError" class="text-sm text-red-600">Failed to load members: {{ fetchError.message }}</div>
    <UTable v-else :data="members ?? []" :columns="columns" />
  </div>
</template>
