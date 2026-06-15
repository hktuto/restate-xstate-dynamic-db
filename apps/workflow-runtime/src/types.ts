import type { AnyMachineSnapshot, AnyStateMachine } from 'xstate'
import type { CreateWorkflowRequest, SendWorkflowRequest, WaitForWorkflowRequest } from 'shared'

export type { CreateWorkflowRequest, SendWorkflowRequest, WaitForWorkflowRequest }

export interface RuntimeContext {
  record: Record<string, unknown>
  tableName: string
  companyId?: string
  namespace?: string
}

export interface PersistedState {
  schemaVersion: number
  snapshot: AnyMachineSnapshot
  config: CreateWorkflowRequest['config']
  context: RuntimeContext
  subscriptions: Partial<Record<Condition, Subscription>>
}

export interface Subscription {
  awakeables: string[]
}

export type Condition = 'done' | `hasTag:${string}`
