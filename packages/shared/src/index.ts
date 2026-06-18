export * from './session.js'
export * from './auth.js'

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
  displayType: 'text' | 'email' | 'url' | 'number' | 'select' | 'checkbox' | 'date' | 'json' | 'richText'
  description?: string
  required?: boolean
  hidden?: boolean
  defaultValue?: unknown
  config?: Record<string, unknown>
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
