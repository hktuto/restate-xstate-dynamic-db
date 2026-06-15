import type { ActionMetadata, GuardMetadata } from 'shared'

export type { ActionMetadata, GuardMetadata }

export interface ActionExecutorContext {
  event: any
  record: Record<string, unknown>
  tableName: string
  companyId?: string
  namespace?: string
  params?: Record<string, unknown>
}

export type ActionExecutor = (ctx: ActionExecutorContext) => Promise<void> | void

export interface RuntimeAction {
  meta: ActionMetadata
  execute: ActionExecutor
}

export interface GuardExecutorContext {
  event: any
  record: Record<string, unknown>
  params?: Record<string, unknown>
}

export type GuardExecutor = (ctx: GuardExecutorContext) => boolean

export interface RuntimeGuard {
  meta: GuardMetadata
  evaluate: GuardExecutor
}
