import { toRef, watch, type MaybeRef } from 'vue'

export interface PageMeta {
  title?: string
  icon?: string
}

export function usePageMeta(meta: MaybeRef<PageMeta>) {
  const state = useState<PageMeta>('pageMeta', () => ({}))
  const metaRef = toRef(meta)

  watch(
    metaRef,
    (value) => {
      state.value = { ...value }
    },
    { immediate: true, deep: true },
  )

  onUnmounted(() => {
    state.value = {}
  })
}
