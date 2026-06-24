import { onScopeDispose, readonly, toRef, watch, type MaybeRef } from 'vue'

export interface PageMeta {
  title?: string
  icon?: string
}

export function usePageMeta(meta: MaybeRef<PageMeta>) {
  const state = useState<PageMeta>('pageMeta', () => ({}))
  const consumers = useState<number>('pageMetaConsumers', () => 0)
  const metaRef = toRef(meta)

  consumers.value++

  watch(
    metaRef,
    (value) => {
      state.value = { ...value }
    },
    { immediate: true, deep: true },
  )

  onScopeDispose(() => {
    consumers.value = Math.max(0, consumers.value - 1)
    if (consumers.value === 0) {
      state.value = {}
    }
  })

  return { pageMeta: readonly(state) }
}
