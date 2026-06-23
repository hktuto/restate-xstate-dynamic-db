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

// ponytail: recursive toRaw + object/array clone handles Vue reactive proxies.
// Upgrade to a generic structuredClone fallback if view config ever holds Dates/Maps/etc.
export function deepClone<T>(value: T): T {
  if (value === undefined) return undefined as T
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map(deepClone) as T
  }
  const raw = toRaw(value)
  const clone: Record<string, unknown> = {}
  for (const key in raw) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      clone[key] = deepClone(raw[key])
    }
  }
  return clone as T
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
