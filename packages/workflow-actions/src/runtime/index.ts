import type { WorkflowDefinition, ExecuteWorkflowRequest } from 'shared'
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
  ctx: { run: (name: string, fn: () => Promise<void> | void) => Promise<unknown> },
  req: ExecuteWorkflowRequest
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

export function createGuardRegistry(_req: ExecuteWorkflowRequest): GuardRegistry {
  const guards: Record<string, (args: { event: any }) => boolean> = {}

  for (const [guardId, runtimeGuard] of Object.entries(runtimeGuards)) {
    guards[guardId] = ({ event }) => {
      return runtimeGuard.evaluate({
        event,
        record: _req.record
      })
    }
  }

  return { guards }
}

export { runtimeActions, runtimeGuards }
