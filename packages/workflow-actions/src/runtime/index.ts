import type { ObjectContext } from '@restatedev/restate-sdk'
import { fromPromise } from 'xstate'
import type { PromiseActorLogic } from 'xstate'
import type { CreateWorkflowRequest } from 'shared'
import type { ActionExecutorContext } from '../types.js'
import { runtimeActions } from './actions.js'
import { runtimeGuards } from './guards.js'

export { runtimeActions, runtimeGuards }

export interface ActionActorInput {
  params?: Record<string, unknown>
  outputKey?: string
  context: Record<string, unknown>
  event: any
}

export interface ActionActors {
  actors: Record<string, PromiseActorLogic<unknown, ActionActorInput>>
}

export function createActionActors(
  objectCtx: Pick<ObjectContext, 'run'>,
  req: Pick<CreateWorkflowRequest, 'record' | 'tableName' | 'companyId' | 'namespace'>
): ActionActors {
  const actors: Record<string, PromiseActorLogic<unknown, ActionActorInput>> = {}

  for (const [actionId, runtimeAction] of Object.entries(runtimeActions)) {
    actors[actionId] = fromPromise(async ({ input }: { input: ActionActorInput }) => {
      const executorCtx: ActionExecutorContext = {
        event: input.event,
        context: input.context,
        record: (input.context.record ?? req.record) as Record<string, unknown>,
        tableName: (input.context.tableName ?? req.tableName) as string,
        companyId: (input.context.companyId ?? req.companyId) as string | undefined,
        namespace: (input.context.namespace ?? req.namespace) as string | undefined,
        params: input.params
      }

      return objectCtx.run(actionId, async () => {
        return runtimeAction.execute(executorCtx)
      })
    })
  }

  return { actors }
}

export interface GuardRegistry {
  guards: Record<string, (args: { context: Record<string, unknown>; event: any }) => boolean>
}

function resolveGuardRef(
  guardId: string,
  config: CreateWorkflowRequest['config']
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

export function createGuardRegistry(
  req: Pick<CreateWorkflowRequest, 'record' | 'config'>
): GuardRegistry {
  const guards: GuardRegistry['guards'] = {}

  for (const [guardId, runtimeGuard] of Object.entries(runtimeGuards)) {
    guards[guardId] = ({ context, event }) => {
      const ref = resolveGuardRef(guardId, req.config)
      return runtimeGuard.evaluate({
        event,
        context,
        record: (context?.record ?? req.record) as Record<string, unknown>,
        params: ref?.params
      })
    }
  }

  return { guards }
}
