import { assign, createMachine, raise } from 'xstate'
import type { AnyEventObject, AnyStateMachine } from 'xstate'
import type { ObjectContext } from '@restatedev/restate-sdk'
import type { WorkflowDefinition, CreateWorkflowRequest } from 'shared'
import { createActionActors, createGuardRegistry } from 'workflow-actions/runtime'
import type { ActionActorInput } from 'workflow-actions/runtime'
import type { RuntimeContext } from './types.js'

// Cast because the event carries a dynamic output key that cannot be typed statically.
const assignOutput = assign(({ event }: any) => {
  const outputKey = event.output?.outputKey
  if (!outputKey) return {}
  return { [outputKey]: event.output.data }
}) as any

// Cast because the event carries a dynamic error shape that cannot be typed statically.
const assignError = assign(({ event }: any) => ({
  lastError: {
    message: event.error?.message ?? String(event.error ?? 'unknown error')
  }
})) as any

export function compileWorkflow(
  definition: WorkflowDefinition,
  context: RuntimeContext,
  objectCtx: Pick<ObjectContext, 'run'>
): { machine: AnyStateMachine; promises: Promise<unknown>[] } {
  const registryContext: Pick<CreateWorkflowRequest, 'record' | 'tableName' | 'companyId' | 'namespace' | 'config'> = {
    config: definition,
    tableName: context.tableName,
    record: context.record,
    companyId: context.companyId,
    namespace: context.namespace
  }

  const promises: Promise<unknown>[] = []
  const { actors } = createActionActors(objectCtx, registryContext, promises)
  const guardRegistry = createGuardRegistry(registryContext)

  const states: Record<string, Record<string, unknown>> = {}

  for (const [stateId, stateDef] of Object.entries(definition.states)) {
    states[stateId] = {}

    if (stateDef.on) states[stateId].on = stateDef.on
    if (stateDef.tags) states[stateId].tags = stateDef.tags
    if (stateDef.type === 'final') states[stateId].type = 'final'
    if (stateDef.meta) states[stateId].meta = stateDef.meta

    const actionId = stateDef.meta?.action as string | undefined
    if (actionId && actors[actionId]) {
      const isCondition = actionId === 'condition'

      states[stateId].invoke = {
        src: actionId,
        input: ({ context: machineContext, event }: { context: unknown; event: AnyEventObject }): ActionActorInput => ({
          params: stateDef.meta?.params as Record<string, unknown> | undefined,
          outputKey: stateDef.meta?.outputKey as string | undefined,
          context: machineContext as Record<string, unknown>,
          event
        }),
        onDone: isCondition
          ? {
              actions: [
                raise(({ event }) => {
                  const output = (event as { output?: { data: unknown } }).output
                  return { type: output?.data === true ? 'true' : 'false' }
                })
              ]
            }
          : {
              actions: [
                assignOutput,
                raise({ type: 'ok' })
              ]
            },
        onError: isCondition
          ? {
              actions: [
                assignError,
                raise({ type: 'false' })
              ]
            }
          : {
              actions: [
                assignError,
                raise({ type: 'error' })
              ]
            }
      }
    }
  }

  return {
    machine: createMachine(
      {
        ...definition,
        context: { ...context },
        states
      },
      {
        actors,
        guards: guardRegistry.guards,
        actions: { assignOutput, assignError }
      }
    ),
    promises
  }
}
