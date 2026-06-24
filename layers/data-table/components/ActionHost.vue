<script setup lang="ts">
import type { ResolvedActionPlacement } from '../utils/view-actions'
import type { ActionContext } from 'shared'

interface Props {
  actions: ResolvedActionPlacement[]
  context: ActionContext
}

const props = defineProps<Props>()
const refs = shallowRef<Record<string, any>>({})

function setRef(name: string, el: unknown) {
  if (el) {
    refs.value[name] = el
  }
}

function trigger(component: string, method?: string | null, record?: Record<string, unknown>) {
  const instance = refs.value[component]
  const actionMethod = method ?? 'open'
  if (!instance || typeof instance[actionMethod] !== 'function') return
  const context: ActionContext = record ? { ...props.context, record } : props.context
  instance[actionMethod](context)
}

defineExpose({ trigger })
</script>

<template>
  <div class="hidden">
    <component
      v-for="action in actions"
      :key="action.component"
      :is="action.component"
      :ref="(el: any) => setRef(action.component, el)"
      :context="context"
    />
  </div>
</template>
