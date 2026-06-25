import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import type { FilterGroup, ViewDefinition } from 'shared'
import {
  buildRuntimeView,
  isDirty,
  mergeFilter,
  mergeRuntimeToView,
} from './view-state.js'

const baseView: ViewDefinition = {
  id: 'v1',
  table: 'orders',
  type: 'table',
  name: 'Default',
  config: {
    table: {
      columns: [
        { column: 'id', visible: true },
        { column: 'total', visible: true },
      ],
    },
  },
  sort: [{ field: 'createdAt', direction: 'desc' }],
  group: [{ field: 'status' }],
  filter: {
    op: 'and',
    conditions: [
      { field: 'active', operator: 'eq', value: true },
    ],
  },
}

describe('buildRuntimeView', () => {
  it('clones deeply', () => {
    const runtime = buildRuntimeView(baseView)

    runtime.sort[0]!.direction = 'asc'
    runtime.columns[0]!.visible = false
    runtime.filter!.conditions.push({
      field: 'x',
      operator: 'eq',
      value: 'y',
    } as unknown as FilterGroup)

    expect(baseView.sort![0]!.direction).toBe('desc')
    expect(baseView.config.table!.columns[0]!.visible).toBe(true)
    expect(baseView.filter!.conditions).toHaveLength(1)
  })
})

describe('isDirty', () => {
  it('returns false when runtime matches view', () => {
    const runtime = buildRuntimeView(baseView)
    expect(isDirty(runtime, baseView, true)).toBe(false)
  })

  it('returns true when sort changes', () => {
    const runtime = buildRuntimeView(baseView)
    runtime.sort[0]!.direction = 'asc'
    expect(isDirty(runtime, baseView, true)).toBe(true)
  })

  it('returns true when columns change', () => {
    const runtime = buildRuntimeView(baseView)
    runtime.columns[0]!.visible = false
    expect(isDirty(runtime, baseView, true)).toBe(true)
  })

  it('returns false for locked view filter when user has not added conditions', () => {
    const view: ViewDefinition = {
      ...baseView,
      filter: {
        op: 'and',
        conditions: [{ field: 'locked', operator: 'eq', value: 1 }],
      },
    }
    const runtime = buildRuntimeView(view)
    runtime.filter = undefined

    expect(isDirty(runtime, view, false)).toBe(false)
  })
})

describe('mergeFilter', () => {
  it('combines locked and user-added conditions', () => {
    const locked: FilterGroup = {
      op: 'and',
      conditions: [{ field: 'a', operator: 'eq', value: 1 }],
    }
    const added: FilterGroup = {
      op: 'and',
      conditions: [{ field: 'b', operator: 'eq', value: 2 }],
    }

    const result = mergeFilter(locked, added)

    expect(result).toEqual({
      op: 'and',
      conditions: [
        { field: 'a', operator: 'eq', value: 1 },
        { field: 'b', operator: 'eq', value: 2 },
      ],
    })
  })

  it('returns locked filter when added is empty', () => {
    const locked: FilterGroup = {
      op: 'and',
      conditions: [{ field: 'a', operator: 'eq', value: 1 }],
    }

    const result = mergeFilter(locked, { op: 'and', conditions: [] })

    expect(result).toEqual(locked)
    expect(result).not.toBe(locked)
  })

  it('returns added filter when locked is empty', () => {
    const added: FilterGroup = {
      op: 'and',
      conditions: [{ field: 'b', operator: 'eq', value: 2 }],
    }

    const result = mergeFilter(undefined, added)

    expect(result).toEqual(added)
    expect(result).not.toBe(added)
  })
})

describe('mergeRuntimeToView', () => {
  it('omits empty arrays and undefined filters', () => {
    const view: ViewDefinition = {
      id: 'v2',
      table: 'orders',
      type: 'table',
      name: 'Empty',
      config: { table: { columns: [] } },
    }
    const runtime = buildRuntimeView(view)

    const merged = mergeRuntimeToView(runtime, view, true)

    expect(merged.sort).toBeUndefined()
    expect(merged.group).toBeUndefined()
    expect(merged.filter).toBeUndefined()
  })

  it('updates columns in view config', () => {
    const runtime = buildRuntimeView(baseView)
    runtime.columns[0]!.visible = false

    const merged = mergeRuntimeToView(runtime, baseView, true)

    expect(merged.config.table?.columns[0]!.visible).toBe(false)
    expect(baseView.config.table?.columns[0]!.visible).toBe(true)
  })

  it('clones reactive runtime state without DataCloneError', () => {
    const runtime = reactive(buildRuntimeView(baseView))
    runtime.columns[0]!.visible = false

    expect(() => mergeRuntimeToView(runtime as unknown as ReturnType<typeof buildRuntimeView>, baseView, true)).not.toThrow()

    const merged = mergeRuntimeToView(runtime as unknown as ReturnType<typeof buildRuntimeView>, baseView, true)
    expect(merged.config.table?.columns[0]!.visible).toBe(false)
  })
})
