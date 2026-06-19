<script setup lang="ts">
import type { WorkflowDefinition, StartRule } from 'shared'

interface WorkflowDesign {
  id: string
  name: string
  xstateConfig: WorkflowDefinition
  starts?: StartRule[]
}

interface TriggerRow {
  designId: string
  designName: string
  startIndex: number
  tableName: string
  event: string
}

const designs = ref<WorkflowDesign[]>([])
const api = useApi()

async function refresh() {
  designs.value = await api.fetch<WorkflowDesign[]>('/api/admin/workflow-designs')
}

await refresh()

const triggerRows = computed<TriggerRow[]>(() => {
  const rows: TriggerRow[] = []
  for (const design of designs.value) {
    const starts = design.starts ?? []
    for (const [i, start] of starts.entries()) {
      if (start.type === 'db_trigger') {
        rows.push({
          designId: design.id,
          designName: design.name,
          startIndex: i,
          tableName: String(start.options.tableName ?? ''),
          event: String(start.options.event ?? '')
        })
      }
    }
  }
  return rows
})

const form = reactive({
  tableName: 'companies',
  event: 'create',
  designId: undefined as string | undefined
})

async function createTrigger() {
  if (!form.designId) return
  const design = designs.value.find((d) => d.id === form.designId)
  if (!design) return
  const existingStarts = design.starts ?? []
  await api.fetch(`/api/admin/workflow-designs/${form.designId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      starts: [
        ...existingStarts,
        {
          type: 'db_trigger',
          startState: design.xstateConfig.initial,
          options: { tableName: form.tableName, event: form.event }
        }
      ]
    })
  })
  form.designId = undefined
  await refresh()
}

async function deleteTrigger(row: TriggerRow) {
  const design = designs.value.find((d) => d.id === row.designId)
  if (!design) return
  const starts = design.starts ?? []
  await api.fetch(`/api/admin/workflow-designs/${row.designId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      starts: starts.filter((_, i) => i !== row.startIndex)
    })
  })
  await refresh()
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-4">Platform triggers</h1>

    <form class="bg-white p-4 rounded shadow mb-6 space-y-3" @submit.prevent="createTrigger">
      <h2 class="font-semibold">Attach workflow design to a platform event</h2>
      <div class="grid grid-cols-3 gap-3">
        <select v-model="form.tableName" class="border rounded px-3 py-2">
          <option value="companies">companies</option>
        </select>
        <select v-model="form.event" class="border rounded px-3 py-2">
          <option value="create">create</option>
          <option value="update">update</option>
          <option value="delete">delete</option>
        </select>
        <select v-model="form.designId" class="border rounded px-3 py-2">
          <option :value="undefined">Select workflow design</option>
          <option v-for="design in designs" :key="design.id" :value="design.id">{{ design.name }}</option>
        </select>
      </div>
      <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Attach</button>
    </form>

    <table class="w-full bg-white rounded shadow">
      <thead class="bg-gray-100">
        <tr>
          <th class="text-left p-3">Table</th>
          <th class="text-left p-3">Event</th>
          <th class="text-left p-3">Workflow design</th>
          <th class="text-left p-3"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in triggerRows" :key="`${t.designId}-${t.startIndex}`" class="border-t">
          <td class="p-3">{{ t.tableName }}</td>
          <td class="p-3">{{ t.event }}</td>
          <td class="p-3">{{ t.designName }}</td>
          <td class="p-3">
            <button class="text-red-600 hover:underline" @click="deleteTrigger(t)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
