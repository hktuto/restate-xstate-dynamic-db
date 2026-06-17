import type { ObjectContext } from '@restatedev/restate-sdk'
import { fromPromise } from 'xstate'
import type { PromiseActorLogic } from 'xstate'
import type { CreateWorkflowRequest } from 'shared'
import type { ActionExecutorContext } from '../types.js'
import { upsertWorkflowAction } from 'db/workflow-actions'
import { runtimeActions } from './actions.js'
import { runtimeGuards } from './guards.js'

export { runtimeActions, runtimeGuards }

export interface ActionActorInput {
  params?: Record<string, unknown>
  outputKey?: string
  context: Record<string, unknown>
  event: any
  instanceId: string
  stateId: string
}

export interface ActionActorOutput {
  data: unknown
  outputKey: string | undefined
}

export interface ActionActors {
  actors: Record<string, PromiseActorLogic<ActionActorOutput, ActionActorInput>>
}

export function createActionActors(
  objectCtx: Pick<ObjectContext, 'run'>,
  req: Pick<CreateWorkflowRequest, 'record' | 'tableName' | 'companyId' | 'namespace' | 'config'>,
  promises: Promise<unknown>[] = []
): ActionActors {
  const actors: Record<string, PromiseActorLogic<ActionActorOutput, ActionActorInput>> = {}

  for (const [actionId, runtimeAction] of Object.entries(runtimeActions)) {
    actors[actionId] = fromPromise(async ({ input }: { input: ActionActorInput }) => {
      const executorCtx: ActionExecutorContext = {
        event: input.event,
        context: input.context,
        record: (input.context.record ?? req.record) as Record<string, unknown>,
        tableName: (input.context.tableName ?? req.tableName) as string,
        companyId: (input.context.companyId ?? req.companyId) as string | undefined,
        namespace: (input.context.namespace ?? req.namespace) as string | undefined,
        instanceId: input.instanceId,
        params: input.params
      }

      const runPromise = objectCtx.run(actionId, async () => {
        const auditId = `${input.instanceId}:${input.stateId}`
        const startedAt = new Date().toISOString()
        const namespace = executorCtx.namespace

        const audit = async (data: Parameters<typeof upsertWorkflowAction>[2]) => {
          if (!namespace) return
          await upsertWorkflowAction(namespace, auditId, data)
        }

        try {
          await audit({
            instanceId: input.instanceId,
            workflowId: req.config?.id ?? '',
            stateId: input.stateId,
            action: actionId,
            params: input.params,
            status: 'started',
            inputContext: input.context,
            startedAt
          })
        } catch {
          // Audit failures must not prevent the action from running.
        }

        try {
          const data = await runtimeAction.execute(executorCtx)
          const isCondition = actionId === 'condition'
          const resultEvent = isCondition
            ? (data === true ? 'true' : 'false')
            : 'ok'
          const outputContext: Record<string, unknown> = {
            ...input.context,
            ...(input.outputKey ? { [input.outputKey]: data } : {})
          }

          try {
            await audit({
              instanceId: input.instanceId,
              workflowId: req.config?.id ?? '',
              stateId: input.stateId,
              action: actionId,
              params: input.params,
              status: 'completed',
              inputContext: input.context,
              outputContext,
              outputData: data,
              resultEvent,
              startedAt,
              completedAt: new Date().toISOString()
            })
          } catch {
            // Audit failures must not change the action result.
          }

          return { data, outputKey: input.outputKey }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          try {
            await audit({
              instanceId: input.instanceId,
              workflowId: req.config?.id ?? '',
              stateId: input.stateId,
              action: actionId,
              params: input.params,
              status: 'failed',
              inputContext: input.context,
              outputContext: input.context,
              resultEvent: actionId === 'condition' ? 'false' : 'error',
              errorMessage: message,
              startedAt,
              completedAt: new Date().toISOString()
            })
          } catch {
            // Audit failures must not mask the original action error.
          }
          throw error
        }
      })

      promises.push(runPromise.catch(() => {}))
      return runPromise
    })
  }

  return { actors }
}

export interface GuardRegistry {
  guards: Record<
    string,
    (args: { context: Record<string, unknown>; event: any }, params: Record<string, unknown>) => boolean
  >
}

export function createGuardRegistry(
  req: Pick<CreateWorkflowRequest, 'record' | 'config'>
): GuardRegistry {
  const guards: GuardRegistry['guards'] = {}

  for (const [guardId, runtimeGuard] of Object.entries(runtimeGuards)) {
    guards[guardId] = ({ context, event }, params) => {
      return runtimeGuard.evaluate({
        event,
        context,
        record: (context?.record ?? req.record) as Record<string, unknown>,
        params
      })
    }
  }

  return { guards }
}
