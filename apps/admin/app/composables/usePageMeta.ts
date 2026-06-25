import { onScopeDispose, readonly, toRef, unref, watch, type MaybeRef } from 'vue'

export interface PageMeta {
  title?: MaybeRef<string>
  icon?: string
}

export function usePageMeta(meta: MaybeRef<PageMeta>) {
  const state = useState<PageMeta>('pageMeta', () => ({}))
  const metaRef = toRef(meta)

  watch(
    metaRef,
    (value) => {
      state.value = { title: unref(value.title), icon: value.icon }
    },
    { immediate: true, deep: true },
  )

  onScopeDispose(() => {
    state.value = {}
  })

  return { pageMeta: readonly(state) }
}
