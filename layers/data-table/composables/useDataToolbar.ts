import { computed, reactive, ref, toRef, watch, type Ref } from 'vue'
import type { MaybeRef } from 'vue'
import type { ViewDefinition } from 'shared'
import { buildRuntimeView, isDirty, mergeRuntimeToView, type RuntimeViewState } from '../utils/view-state'

const EMPTY_VIEW: ViewDefinition = {
  id: '',
  name: '',
  table: '',
  type: 'table',
  isDefault: false,
  config: { table: { columns: [] } },
}

export function useDataToolbar(view: Ref<ViewDefinition | undefined | null>, canUpdateView: MaybeRef<boolean> = false) {
  const canUpdate = toRef(canUpdateView)
  const safeView = computed(() => view.value ?? EMPTY_VIEW)

  function buildRuntime(): RuntimeViewState {
    const state = buildRuntimeView(safeView.value)
    state.filter = state.filter ?? { op: 'and', conditions: [] }
    if (!canUpdate.value) {
      state.filter = { op: 'and', conditions: [] }
    }
    return state
  }

  const runtime = ref<RuntimeViewState>(reactive(buildRuntime()))

  watch([view, canUpdate], () => {
    runtime.value = reactive(buildRuntime())
  }, { immediate: false })

  const dirty = computed(() => isDirty(runtime.value, safeView.value, canUpdate.value))

  function save(): ViewDefinition {
    return mergeRuntimeToView(runtime.value, safeView.value, canUpdate.value)
  }

  return {
    runtime,
    dirty,
    save,
  }
}
