import * as restate from '@restatedev/restate-sdk'
import { createMachine, interpret } from 'xstate'
import type { ExecuteWorkflowRequest, WorkflowDefinition } from 'shared'
import { createActionRegistry, createGuardRegistry } from 'workflow-actions/runtime'

const NITRO_API_URL = process.env.NITRO_API_URL || 'http://localhost:3000'
const AWAITING_APPROVAL_STATE = 'awaitingApproval'

function toXStateConfig(definition: WorkflowDefinition): any {
  const states: Record<string, any> = {}
  for (const [stateId, stateDef] of Object.entries(definition.states)) {
    states[stateId] = {}
    if (stateDef.entry?.length) {
      states[stateId].entry = stateDef.entry.map(entry =>
        typeof entry === 'string' ? entry : { type: entry.id }
      )
    }
    if (stateDef.on) {
      states[stateId].on = stateDef.on
    }
  }
  return { ...definition, states }
}

const workflowService = restate.service({
  name: 'workflow',
  handlers: {
    executeWorkflow: async (ctx: restate.Context, req: ExecuteWorkflowRequest) => {
      const registry = createActionRegistry(ctx, req)
      const guardRegistry = createGuardRegistry(req)

      const machine = createMachine(toXStateConfig(req.config), {
        actions: registry.actions,
        guards: guardRegistry.guards
      })

      const actor = interpret(machine)
      actor.start()
      actor.send({ type: req.event!, record: req.record })

      const snapshot = actor.getSnapshot()

      if (snapshot.value === AWAITING_APPROVAL_STATE) {
        const awakeable = ctx.awakeable<{ approved: boolean }>()

        const createApproval = ctx.run('createApprovalRequest', async () => {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (req.namespace) headers['x-company-namespace'] = req.namespace
          const res = await fetch(`${NITRO_API_URL}/api/approvals`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              tableName: req.tableName,
              recordId: req.record.id,
              workflowId: req.workflowId,
              awakeableId: awakeable.id
            })
          })
          if (!res.ok) {
            throw new Error(`Failed to create approval request: ${res.status}`)
          }
        })

        const [_, result] = await restate.CombineablePromise.all([
          createApproval,
          awakeable.promise
        ])

        actor.send({ type: result.approved ? 'approve' : 'reject', record: req.record })
      }

      actor.stop()

      await restate.CombineablePromise.all(registry.promises as any)
      return { ok: true }
    }
  }
})

restate.serve({ services: [workflowService], port: 9080 })
