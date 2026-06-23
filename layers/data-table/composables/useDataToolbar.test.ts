import { describe, it, expect } from 'vitest'
import { ref, nextTick, markRaw, reactive } from 'vue'
import { useDataToolbar } from './useDataToolbar'
import type { ViewDefinition } from 'shared'

describe('useDataToolbar', () => {
  it('does not throw when view is initially undefined', () => {
    const view = ref<ViewDefinition | undefined>(undefined)
    expect(() => useDataToolbar(view as any, ref(false))).not.toThrow()
  })

  it('provides a default empty runtime when view is undefined', () => {
    const view = ref<ViewDefinition | undefined>(undefined)
    const { runtime } = useDataToolbar(view as any, ref(false))
    expect(runtime.value).toBeDefined()
    expect(runtime.value.filter).toEqual({ op: 'and', conditions: [] })
    expect(runtime.value.group).toEqual([])
    expect(runtime.value.sort).toEqual([])
    expect(runtime.value.columns).toEqual([])
  })

  it('rebuilds runtime when view becomes defined', async () => {
    const view = ref<ViewDefinition | undefined>(undefined)
    const { runtime } = useDataToolbar(view as any, ref(true))
    const definedView: ViewDefinition = JSON.parse(JSON.stringify({
      id: 'views:test',
      name: 'Test',
      table: 'companies',
      isDefault: true,
      config: { table: { columns: [{ column: 'name', visible: true }] } },
      sort: [{ field: 'name', direction: 'asc' }],
      group: [{ field: 'status' }],
      filter: { op: 'and', conditions: [{ field: 'name', operator: 'eq', value: 'Acme' }] },
    }))
    view.value = markRaw(definedView)
    await nextTick()
    expect(runtime.value.columns).toEqual([{ column: 'name', visible: true }])
    expect(runtime.value.sort).toEqual([{ field: 'name', direction: 'asc' }])
    expect(runtime.value.group).toEqual([{ field: 'status' }])
    expect(runtime.value.filter).toEqual({ op: 'and', conditions: [{ field: 'name', operator: 'eq', value: 'Acme' }] })
  })

  it('handles reactive views without DataCloneError', async () => {
    const definedView: ViewDefinition = {
      id: 'views:test',
      name: 'Test',
      table: 'companies',
      type: 'table',
      isDefault: true,
      config: { table: { columns: [{ column: 'name', visible: true }] } },
      sort: [{ field: 'name', direction: 'asc' }],
      group: [{ field: 'status' }],
      filter: { op: 'and', conditions: [{ field: 'name', operator: 'eq', value: 'Acme' }] },
    }
    const reactiveView = reactive(definedView)
    const view = ref<ViewDefinition | undefined>(reactiveView as ViewDefinition)
    expect(() => useDataToolbar(view as any, ref(true))).not.toThrow()
    const { runtime } = useDataToolbar(view as any, ref(true))
    await nextTick()
    expect(runtime.value.filter).toEqual({ op: 'and', conditions: [{ field: 'name', operator: 'eq', value: 'Acme' }] })
  })

  it('reflects direct mutations on runtime state', () => {
    const definedView: ViewDefinition = {
      id: 'views:test',
      name: 'Test',
      table: 'companies',
      type: 'table',
      isDefault: true,
      config: { table: { columns: [{ column: 'name', visible: true }] } },
      sort: [],
      group: [],
      filter: { op: 'and', conditions: [] },
    }
    const view = ref<ViewDefinition | undefined>(definedView)
    const { runtime } = useDataToolbar(view as any, ref(true))
    runtime.value.filter!.conditions.push({ field: 'name', operator: 'eq', value: 'Acme' })
    runtime.value.group.push({ field: 'status' })
    runtime.value.sort.push({ field: 'name', direction: 'asc' })
    expect(runtime.value.filter!.conditions).toHaveLength(1)
    expect(runtime.value.group).toHaveLength(1)
    expect(runtime.value.sort).toHaveLength(1)
  })

  it('provides a default empty filter when the view has none and user can update', () => {
    const definedView: ViewDefinition = {
      id: 'views:test',
      name: 'Test',
      table: 'companies',
      type: 'table',
      isDefault: true,
      config: { table: { columns: [{ column: 'name', visible: true }] } },
      sort: [],
      group: [],
    }
    const view = ref<ViewDefinition | undefined>(definedView)
    const { runtime } = useDataToolbar(view as any, ref(true))
    expect(runtime.value.filter).toEqual({ op: 'and', conditions: [] })
    runtime.value.filter!.conditions.push({ field: 'name', operator: 'eq', value: 'Acme' })
    expect(runtime.value.filter!.conditions).toHaveLength(1)
  })
})
