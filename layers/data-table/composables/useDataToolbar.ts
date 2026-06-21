import { computed, ref, toRef, watch, type Ref } from 'vue'
import type { MaybeRef } from 'vue'
import type { ViewDefinition } from 'shared'
import { buildRuntimeView, isDirty, mergeRuntimeToView, type RuntimeViewState } from '../utils/view-state'

export function useDataToolbar(view: Ref<ViewDefinition>, canUpdateView: MaybeRef<boolean> = false) {
  const canUpdate = toRef(canUpdateView)

  function buildRuntime(): RuntimeViewState {
    const state = buildRuntimeView(view.value)
    if (!canUpdate.value) {
      state.filter = { op: 'and', conditions: [] }
    }
    return state
  }

  const runtime = ref<RuntimeViewState>(buildRuntime())

  watch([view, canUpdate], () => {
    runtime.value = buildRuntime()
  }, { immediate: false })

  const dirty = computed(() => isDirty(runtime.value, view.value, canUpdate.value))

  function save(): ViewDefinition {
    return mergeRuntimeToView(runtime.value, view.value, canUpdate.value)
  }

  return {
    runtime,
    dirty,
    save,
  }
}
