import type { ObjectContext } from '@restatedev/restate-sdk'
import type { WorkflowDefinition, CreateWorkflowRequest } from 'shared'
import { runtimeActions } from './actions.js'
import { runtimeGuards } from './guards.js'

export type ActionRef = string | { id: string; params?: Record<string, unknown> }

export interface ActionRegistry {
  actions: Record<string, (args: { event: any }) => void>
  promises: Promise<unknown>[]
}

export interface GuardRegistry {
  guards: Record<string, (args: { event: any }) => boolean>
}

export function createActionRegistry(
  ctx: Pick<ObjectContext, 'run'>,
  req: CreateWorkflowRequest
): ActionRegistry {
  const promises: Promise<unknown>[] = []
  const actions: Record<string, (args: { event: any }) => void> = {}

  for (const [actionId, runtimeAction] of Object.entries(runtimeActions)) {
    actions[actionId] = ({ event }) => {
      const ref = resolveActionRef(actionId, req.config)
      const params = typeof ref === 'object' ? ref.params : undefined
      promises.push(
        ctx.run(actionId, async () => {
          await runtimeAction.execute({
            event,
            record: req.record,
            tableName: req.tableName,
            companyId: req.companyId,
            namespace: req.namespace,
            params
          })
        })
      )
    }
  }

  return { actions, promises }
}

function resolveActionRef(actionId: string, config: WorkflowDefinition): ActionRef {
  for (const state of Object.values(config.states)) {
    for (const entry of state.entry ?? []) {
      if (typeof entry === 'string' && entry === actionId) return entry
      if (typeof entry === 'object' && entry.id === actionId) return entry
    }
  }
  return actionId
}

export function createGuardRegistry(req: CreateWorkflowRequest): GuardRegistry {
  const guards: Record<string, (args: { event: any }) => boolean> = {}

  for (const [guardId, runtimeGuard] of Object.entries(runtimeGuards)) {
    const ref = resolveGuardRef(req.config, guardId)
    guards[guardId] = ({ event }) => {
      return runtimeGuard.evaluate({
        event,
        record: req.record,
        params: ref?.params
      })
    }
  }

  return { guards }
}

function resolveGuardRef(
  config: WorkflowDefinition,
  guardId: string
): { type: string; params?: Record<string, unknown> } | undefined {
  for (const state of Object.values(config.states)) {
    if (!state.on) continue
    for (const transitions of Object.values(state.on)) {
      const normalized = Array.isArray(transitions) ? transitions : [transitions]
      for (const t of normalized) {
        if (typeof t !== 'object' || !t.guard) continue
        const ref = typeof t.guard === 'string' ? { type: t.guard } : t.guard
        if (ref.type === guardId) return ref
      }
    }
  }
  return undefined
}

export { runtimeActions, runtimeGuards }
