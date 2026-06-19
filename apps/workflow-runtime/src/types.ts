import type { AnyMachineSnapshot, AnyStateMachine } from 'xstate'
import type { CreateWorkflowRequest, SendWorkflowRequest, WaitForWorkflowRequest, WorkflowDefinition } from 'shared'

export type { CreateWorkflowRequest, SendWorkflowRequest, WaitForWorkflowRequest }

export interface RuntimeContext {
  instanceId: string
  designId: string
  tableName?: string
  companyId?: string
  namespace?: string
}

export interface PersistedState {
  schemaVersion: number
  snapshot: AnyMachineSnapshot
  config: WorkflowDefinition
  context: Record<string, unknown>
  subscriptions: Partial<Record<Condition, Subscription>>
}

export interface Subscription {
  awakeables: string[]
}

export type Condition = 'done' | `hasTag:${string}`
