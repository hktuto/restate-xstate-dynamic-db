import type { ObjectContext } from '@restatedev/restate-sdk'
import { fromPromise } from 'xstate'
import type { PromiseActorLogic } from 'xstate'
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
  runtime: { designId: string; tableName?: string; companyId?: string; namespace?: string; config: { id: string } },
  promises: Promise<unknown>[] = []
): ActionActors {
  const createActor = (
    actionId: string
  ): PromiseActorLogic<ActionActorOutput, ActionActorInput> =>
    fromPromise(async ({ input }: { input: ActionActorInput }) => {
      const runtimeMeta = (input.context as any).__runtime as
        | { tableName?: string; companyId?: string; namespace?: string }
        | undefined

      const executorCtx: ActionExecutorContext = {
        event: input.event,
        context: input.context,
        record: input.context as Record<string, unknown>,
        tableName: (runtimeMeta?.tableName ?? runtime.tableName) as string,
        companyId: (runtimeMeta?.companyId ?? runtime.companyId) as string | undefined,
        namespace: (runtimeMeta?.namespace ?? runtime.namespace) as string | undefined,
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

        await audit({
          instanceId: input.instanceId,
          designId: runtime.designId,
          stateId: input.stateId,
          action: actionId,
          params: input.params,
          status: 'started',
          inputContext: input.context,
          startedAt
        })

        try {
          const data = await runtimeActions[actionId].execute(executorCtx)
          const isCondition = actionId === 'condition'
          const resultEvent = isCondition
            ? (data === true ? 'true' : 'false')
            : 'ok'
          const outputContext: Record<string, unknown> = {
            ...input.context,
            ...(input.outputKey ? { [input.outputKey]: data } : {})
          }

          await audit({
            instanceId: input.instanceId,
            designId: runtime.designId,
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

          return { data, outputKey: input.outputKey }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          await audit({
            instanceId: input.instanceId,
            designId: runtime.designId,
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
          throw error
        }
      })

      promises.push(runPromise.catch(() => {}))
      return runPromise
    })

  return {
    actors: {
      getRecord: createActor('getRecord'),
      createRecord: createActor('createRecord'),
      updateRecord: createActor('updateRecord'),
      deleteRecord: createActor('deleteRecord'),
      condition: createActor('condition'),
    }
  }
}

export interface GuardRegistry {
  guards: Record<
    string,
    (args: { context: Record<string, unknown>; event: any }, params: Record<string, unknown>) => boolean
  >
}

export function createGuardRegistry(
  req: { record?: Record<string, unknown>; config?: { id: string } }
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
