export * from './permissions.js'

export interface CompanyRecord {
  id: string
  name: string
  slug: string
  namespace: string
  createdAt: string
}

export interface ParamSchema {
  type: 'string' | 'number' | 'boolean' | 'select' | 'json'
  label: string
  description?: string
  required?: boolean
  options?: { label: string; value: string }[]
  default?: unknown
}

export interface ActionInputMetadata {
  name: string
  label: string
  dbType: 'string' | 'number' | 'boolean' | 'datetime' | 'record' | 'object' | 'array'
  displayType: 'text' | 'email' | 'url' | 'number' | 'select' | 'checkbox' | 'date' | 'json' | 'richText' | 'tag'
  description?: string
  required?: boolean
  hidden?: boolean
  defaultValue?: unknown
  config?: Record<string, unknown>
  fields?: ActionInputMetadata[]
}

export interface ActionMetadata {
  id: string
  label: string
  description?: string
  category?: string
  paramsSchema?: Record<string, ParamSchema>
  inputs?: ActionInputMetadata[]
  tableInput?: string
}

export interface GuardMetadata {
  id: string
  label: string
  description?: string
  paramsSchema?: Record<string, ParamSchema>
}

export interface WorkflowTransition {
  target: string
  guard?: {
    type: string
    params?: Record<string, unknown>
  }
  actions?: (string | { id: string; params?: Record<string, unknown> })[]
}

export interface WorkflowState {
  entry?: (string | { id: string; params?: Record<string, unknown> })[]
  exit?: (string | { id: string; params?: Record<string, unknown> })[]
  on?: Record<string, WorkflowTransition | WorkflowTransition[]>
  tags?: string[]
  type?: 'final'
  meta?: Record<string, unknown>
}

export interface WorkflowDefinition {
  id: string
  initial: string
  states: Record<string, WorkflowState>
  context?: Record<string, unknown>
  meta?: Record<string, unknown>
}

export interface StartRule {
  type: 'db_trigger' | 'user_trigger' | 'cron' | 'webhook'
  startState: string
  options: Record<string, unknown>
}

export interface TriggerBy {
  type: 'db_trigger' | 'user_trigger' | 'cron' | 'webhook'
  startState: string
}

export interface CreateWorkflowRequest {
  designId: string
  trigger: TriggerBy
  context?: Record<string, unknown>
  createdBy: string
  companyId?: string
  namespace?: string
}

export interface SendWorkflowRequest {
  event: string
  record?: Record<string, unknown>
}

export interface WaitForWorkflowRequest {
  condition: 'done' | `hasTag:${string}`
  timeout?: number
  event?: string
}

/** @deprecated Use `CreateWorkflowRequest` instead. */
export type ExecuteWorkflowRequest = CreateWorkflowRequest

/** Supported SurrealDB column data types. */
export interface ColumnDefinition {
  name: string
  label?: string
  dbType: 'string' | 'number' | 'boolean' | 'datetime' | 'object' | 'array' | 'record'
  displayType: 'text' | 'url' | 'email' | 'user' | 'select' | 'checkbox' | 'date' | 'number' | 'relation' | 'formula' | 'richText' | 'json' | 'tag'
  config?: Record<string, unknown>
  fields?: ColumnDefinition[]
  system?: boolean
  unique?: boolean
  uniqueScope?: string
  optional?: boolean
  defaultValue?: unknown
  hidden?: boolean
  order?: number
}

/** Defines a directed relation between a column in one table and a column in another table. */
export interface RelationDefinition {
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  linkTable?: string
}

/** Complete schema for a single table, including columns and optional relations. */
export interface TableSchemaDefinition {
  name: string
  label?: string
  description?: string
  hidden?: boolean
  columns: ColumnDefinition[]
  relations?: RelationDefinition[]
}

/** Table metadata row. */
export interface TableRow {
  id: string
  name: string
  label?: string
  description?: string
  hidden?: boolean
  createdAt?: string
  updatedAt?: string
}

/** Column metadata row. */
export interface ColumnRow extends ColumnDefinition {
  table: string
}

/** Relation metadata row. */
export interface RelationRow {
  id: string
  name?: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  linkTable?: string
  createdAt?: string
  updatedAt?: string
}

/** Complete schema for a single table, including columns and relations. */
export interface TableSchema {
  table: TableRow
  columns: ColumnRow[]
  relations: RelationRow[]
}

/** Configuration for a single column inside a table view. */
export interface TableColumnConfig {
  column: string
  label?: string
  width?: 'auto' | number
  visible?: boolean
}

/** Configuration for a table view. */
export interface TableViewConfig {
  columns: TableColumnConfig[]
}

/** Saved sort preferences. */
export interface SortSetting {
  field: string
  direction: 'asc' | 'desc'
}

export interface FilterCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn'
  value: unknown
}

export interface FilterGroup {
  op: 'and' | 'or'
  conditions: (FilterCondition | FilterGroup)[]
}

export interface GroupSetting {
  field: string
}

/** Per-view-type configuration. */
export interface ViewConfig {
  table?: TableViewConfig
}

/** Defines a saved view for a table. */
export interface ViewDefinition {
  id?: string
  table: string
  type: 'table'
  name: string
  description?: string
  isDefault?: boolean
  config: ViewConfig
  sort?: SortSetting[]
  filter?: FilterGroup
  group?: GroupSetting[]
}
