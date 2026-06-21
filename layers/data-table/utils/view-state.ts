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

export function buildRuntimeView(view: ViewDefinition): RuntimeViewState {
  return {
    filter: structuredClone(view.filter),
    group: structuredClone(view.group ?? []),
    sort: structuredClone(view.sort ?? []),
    columns: structuredClone(view.config.table?.columns ?? []),
  }
}

function isEmptyFilter(filter?: FilterGroup): boolean {
  return !filter || filter.conditions.length === 0
}

export function mergeFilter(
  locked: FilterGroup | undefined,
  added: FilterGroup | undefined,
): FilterGroup | undefined {
  if (isEmptyFilter(added)) return structuredClone(locked)
  if (isEmptyFilter(locked)) return structuredClone(added)

  if (locked!.op === 'and' && added!.op === 'and') {
    return {
      op: 'and',
      conditions: [
        ...structuredClone(locked!.conditions),
        ...structuredClone(added!.conditions),
      ],
    }
  }

  return {
    op: 'and',
    conditions: [structuredClone(locked!), structuredClone(added!)],
  }
}

function effectiveFilter(
  runtime: RuntimeViewState,
  view: ViewDefinition,
  canUpdateView: boolean,
): FilterGroup | undefined {
  return canUpdateView ? runtime.filter : mergeFilter(view.filter, runtime.filter)
}

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
    ...structuredClone(view),
    sort: runtime.sort.length > 0 ? runtime.sort : undefined,
    group: runtime.group.length > 0 ? runtime.group : undefined,
    filter: isEmptyFilter(filter) ? undefined : filter,
  }
}
