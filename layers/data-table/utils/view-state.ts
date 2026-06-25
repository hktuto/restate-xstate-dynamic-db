import { toRaw } from 'vue'
import type {
  FilterGroup,
  GroupSetting,
  SortSetting,
  TableColumnConfig,
  ViewDefinition,
} from 'shared'

export interface RuntimeViewState {
  filter?: FilterGroup
  group: GroupSetting[]
  sort: SortSetting[]
  columns: TableColumnConfig[]
}

function deepToRaw(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepToRaw)
  if (value instanceof Date) return value
  if (value instanceof RegExp) return value
  if (value instanceof Map) return new Map([...value.entries()].map(([k, v]) => [k, deepToRaw(v)]))
  if (value instanceof Set) return new Set([...value].map(deepToRaw))
  if (value && typeof value === 'object') {
    const raw = toRaw(value)
    const clone: Record<string, unknown> = {}
    for (const key of Object.keys(raw)) {
      clone[key] = deepToRaw((raw as Record<string, unknown>)[key])
    }
    return clone
  }
  return value
}

// ponytail: structuredClone assumes plain, serializable view config.
// deepToRaw strips Vue proxies before cloning so reactive arrays/objects don't throw DataCloneError.
// Upgrade to a custom clone if columns/filters ever hold non-JSON values that structuredClone can't copy.
export function deepClone<T>(value: T): T {
  return structuredClone(deepToRaw(value)) as T
}

export function buildRuntimeView(view: ViewDefinition): RuntimeViewState {
  return {
    filter: deepClone(view.filter),
    group: deepClone(view.group ?? []),
    sort: deepClone(view.sort ?? []),
    columns: deepClone(view.config.table?.columns ?? []),
  }
}

function isEmptyFilter(filter?: FilterGroup): boolean {
  return !filter || filter.conditions.length === 0
}

export function mergeFilter(
  locked: FilterGroup | undefined,
  added: FilterGroup | undefined,
): FilterGroup | undefined {
  if (isEmptyFilter(added)) return deepClone(locked)
  if (isEmptyFilter(locked)) return deepClone(added)

  if (locked!.op === 'and' && added!.op === 'and') {
    return {
      op: 'and',
      conditions: [
        ...deepClone(locked!.conditions),
        ...deepClone(added!.conditions),
      ],
    }
  }

  return {
    op: 'and',
    conditions: [deepClone(locked!), deepClone(added!)],
  }
}

export function effectiveFilter(
  runtime: RuntimeViewState,
  view: ViewDefinition,
  canUpdateView: boolean,
): FilterGroup | undefined {
  return canUpdateView ? runtime.filter : mergeFilter(view.filter, runtime.filter)
}

// ponytail: JSON.stringify deep comparison assumes plain, serializable config.
// Upgrade to a deep-equality helper if columns/filters gain Dates, Maps, or unordered props.
export function isDirty(
  runtime: RuntimeViewState,
  view: ViewDefinition,
  canUpdateView: boolean,
): boolean {
  return (
    JSON.stringify(runtime.sort) !== JSON.stringify(view.sort ?? []) ||
    JSON.stringify(runtime.group) !== JSON.stringify(view.group ?? []) ||
    JSON.stringify(runtime.columns) !==
      JSON.stringify(view.config.table?.columns ?? []) ||
    JSON.stringify(effectiveFilter(runtime, view, canUpdateView)) !==
      JSON.stringify(view.filter)
  )
}

export function mergeRuntimeToView(
  runtime: RuntimeViewState,
  view: ViewDefinition,
  canUpdateView: boolean,
): ViewDefinition {
  const filter = effectiveFilter(runtime, view, canUpdateView)

  return {
    ...deepClone(view),
    config: {
      ...deepClone(view.config),
      table: {
        ...(deepClone(view.config.table) ?? {}),
        columns: deepClone(runtime.columns),
      },
    },
    sort: runtime.sort.length > 0 ? deepClone(runtime.sort) : undefined,
    group: runtime.group.length > 0 ? deepClone(runtime.group) : undefined,
    filter: isEmptyFilter(filter) ? undefined : deepClone(filter),
  }
}
