import { createMachine } from 'xstate'
import type { AnyStateMachine } from 'xstate'
import type { ObjectContext } from '@restatedev/restate-sdk'
import type { WorkflowDefinition, CreateWorkflowRequest } from 'shared'
import { createActionRegistry, createGuardRegistry } from 'workflow-actions/runtime'
import type { RuntimeContext } from './types.js'

export function compileWorkflow(
  definition: WorkflowDefinition,
  context: RuntimeContext,
  objectCtx: Pick<ObjectContext, 'run'>
): { machine: AnyStateMachine; promises: Promise<unknown>[] } {
  const registryContext: CreateWorkflowRequest = {
    config: definition,
    event: '', // placeholder; actual event is provided at action/guard execution time
    tableName: context.tableName,
    record: context.record,
    workflowId: definition.id,
    companyId: context.companyId,
    namespace: context.namespace
  }

  const registry = createActionRegistry(objectCtx, registryContext)
  const guardRegistry = createGuardRegistry(registryContext)

  // StateConfig requires generic args that we don't have here, so use a loose record type
  const states: Record<string, Record<string, unknown>> = {}
  for (const [stateId, stateDef] of Object.entries(definition.states)) {
    states[stateId] = {}
    if (stateDef.entry?.length) {
      states[stateId].entry = stateDef.entry.map(entry => {
        if (typeof entry === 'string') return entry
        const action: Record<string, unknown> = { type: entry.id }
        if (entry.params) action.params = entry.params
        return action
      })
    }
    if (stateDef.on) {
      states[stateId].on = stateDef.on
    }
    if (stateDef.tags) {
      states[stateId].tags = stateDef.tags
    }
    if (stateDef.type === 'final') {
      states[stateId].type = 'final'
    }
    if (stateDef.meta) {
      states[stateId].meta = stateDef.meta
    }
  }

  return {
    machine: createMachine(
      {
        ...definition,
        context: {
          ...context
        },
        states
      },
      {
        actions: registry.actions,
        guards: guardRegistry.guards
      }
    ),
    promises: registry.promises
  }
}
