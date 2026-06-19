import * as restate from '@restatedev/restate-sdk'
import type { AnyMachineSnapshot, AnyStateMachine } from 'xstate'
import { createActor, getStateNodes } from 'xstate'
import type { CreateWorkflowRequest, SendWorkflowRequest, WaitForWorkflowRequest, WorkflowDefinition } from 'shared'
import { compileWorkflow } from './compile.js'
import { restoreActor } from './snapshot.js'
import { evaluateCondition, registerSubscription, resolveMatchingSubscriptions } from './subscriptions.js'
import type { Condition, PersistedState, RuntimeContext } from './types.js'

export const SCHEMA_VERSION = 1
const NITRO_API_URL = process.env.NITRO_API_URL || 'http://localhost:3002'

export async function loadState(
  ctx: restate.ObjectContext | restate.ObjectSharedContext
): Promise<PersistedState | null> {
  return await ctx.get<PersistedState>('state')
}

export async function saveState(
  ctx: restate.ObjectContext,
  partial: Partial<PersistedState> & Pick<PersistedState, 'snapshot' | 'context'>
) {
  const existing = await loadState(ctx)
  const config = existing?.config ?? partial.config
  if (!config) {
    throw new Error('saveState requires config when no existing state')
  }
  const next: PersistedState = {
    ...(existing ?? {
      schemaVersion: SCHEMA_VERSION,
      snapshot: partial.snapshot,
      config,
      context: partial.context,
      subscriptions: {}
    }),
    ...partial,
    schemaVersion: SCHEMA_VERSION,
    config
  }
  ctx.set('state', next)
  return next
}

function getTaskType(machine: AnyStateMachine, snapshot: AnyMachineSnapshot): 'approval' | 'review' | 'manual' {
  const nodes = getStateNodes(machine.root, snapshot.value)
  for (const node of nodes) {
    const taskType = node.meta?.taskType
    if (taskType === 'approval' || taskType === 'review' || taskType === 'manual') {
      return taskType
    }
  }
  return 'approval'
}

// Merge request context first, then overlay the actor's snapshot context.
// This preserves action outputs (e.g. outputKey: 'record') over the stale request context.
// Request base fields (record, tableName, companyId, namespace, etc.) are already used to configure the actor/guards;
// they are intentionally not overlaid here so action outputs win.
function snapshotWithContext(
  snapshot: AnyMachineSnapshot,
  context: Record<string, unknown>
): AnyMachineSnapshot {
  return {
    ...snapshot,
    context: {
      ...context,
      ...(snapshot.context as Record<string, unknown>)
    }
  } as AnyMachineSnapshot
}

async function settlePromises(promises: Promise<unknown>[]) {
  for (let i = 0; i < 20; i++) {
    const before = promises.length
    await Promise.all(promises)
    // Give XState one tick to process raised result events from completed invokes.
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (promises.length === before) break
  }
}

async function maybeCreateUserTask(
  ctx: restate.ObjectContext,
  machine: AnyStateMachine,
  snapshot: AnyMachineSnapshot,
  state: Pick<PersistedState, 'context' | 'config'>
) {
  if (!snapshot.hasTag('waiting')) return

  const taskType = getTaskType(machine, snapshot)
  await ctx.run('createUserTask', async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const runtime = (state.context as Record<string, unknown>)['__runtime'] as RuntimeContext | undefined
    const record = (state.context as Record<string, unknown>)['record'] as Record<string, unknown> | undefined
    if (runtime?.namespace) headers['x-company-namespace'] = runtime.namespace
    const res = await fetch(`${NITRO_API_URL}/api/user-tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        instanceId: ctx.key,
        type: taskType,
        tableName: runtime?.tableName,
        recordId: record?.id,
        designId: runtime?.designId,
        namespace: runtime?.namespace
      })
    })
    if (!res.ok) {
      const message = `Failed to create user task: ${res.status}`
      if (res.status >= 400 && res.status < 500) {
        throw new restate.TerminalError(message, { errorCode: res.status })
      }
      throw new Error(message)
    }
  })
}

async function runTransition(
  objectCtx: restate.ObjectContext,
  state: PersistedState,
  event: { type: string; record?: Record<string, unknown> }
): Promise<{ snapshot: AnyMachineSnapshot; context: Record<string, unknown> }> {
  const existingRuntime = (state.context as Record<string, unknown>)['__runtime'] as RuntimeContext | undefined
  const baseContext = { ...state.context }
  delete baseContext.__runtime

  const userContext: Record<string, unknown> = {
    ...baseContext,
    record: { ...((baseContext.record as Record<string, unknown> | undefined) ?? {}), ...(event.record ?? {}) }
  }

  const runtime: RuntimeContext = {
    instanceId: objectCtx.key,
    designId: existingRuntime?.designId ?? (state.config.id as string),
    tableName: existingRuntime?.tableName,
    companyId: existingRuntime?.companyId,
    namespace: existingRuntime?.namespace
  }

  const { machine, promises } = compileWorkflow(
    state.config,
    (state.config.initial as string | undefined) ?? '',
    userContext,
    runtime,
    objectCtx
  )
  const actor = restoreActor(machine, state.snapshot)
  let liveSnapshot: AnyMachineSnapshot
  let persistedSnapshot: AnyMachineSnapshot
  try {
    actor.send(event as any)
    await settlePromises(promises)
    liveSnapshot = actor.getSnapshot()
    persistedSnapshot = actor.getPersistedSnapshot() as AnyMachineSnapshot
  } finally {
    actor.stop()
  }

  const nextContext: Record<string, unknown> = { ...userContext, __runtime: runtime }
  const nextState = { snapshot: persistedSnapshot, config: state.config, context: nextContext }
  await maybeCreateUserTask(objectCtx, machine, liveSnapshot, nextState)
  await resolveMatchingSubscriptions(objectCtx, liveSnapshot)
  await updateInstanceStatus(objectCtx, liveSnapshot, runtime.namespace)

  return { snapshot: persistedSnapshot, context: nextContext }
}

async function updateInstanceStatus(
  ctx: restate.ObjectContext,
  snapshot: AnyMachineSnapshot,
  namespace?: string
) {
  let status: 'pending' | 'running' | 'waiting' | 'done' | 'error' = 'running'
  if (snapshot.status === 'done') status = 'done'
  else if (snapshot.status === 'error') status = 'error'
  else if (snapshot.hasTag('waiting')) status = 'waiting'

  await ctx.run('updateInstanceStatus', async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (namespace) headers['x-company-namespace'] = namespace
    const res = await fetch(`${NITRO_API_URL}/api/workflow-instances/${ctx.key}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, namespace, currentState: snapshot.value })
    })
    if (!res.ok) {
      const message = `Failed to update instance status: ${res.status}`
      if (res.status >= 400 && res.status < 500) {
        throw new restate.TerminalError(message, { errorCode: res.status })
      }
      throw new Error(message)
    }
  })
}

export const workflowObject = restate.object({
  name: 'workflow',
  handlers: {
    create: async (objectCtx: restate.ObjectContext, req: CreateWorkflowRequest) => {
      const existing = await loadState(objectCtx)
      if (existing) return existing.snapshot

      const design = await objectCtx.run('loadDesign', async () => {
        const res = await fetch(`${NITRO_API_URL}/api/workflow-designs/${req.designId}`)
        if (!res.ok) throw new restate.TerminalError(`Design ${req.designId} not found`, { errorCode: 404 })
        return res.json() as Promise<{ xstateConfig: WorkflowDefinition }>
      })

      const runtime = {
        instanceId: objectCtx.key,
        designId: req.designId,
        tableName: req.namespace ? undefined : undefined,
        companyId: req.companyId,
        namespace: req.namespace
      }

      const { machine, promises } = compileWorkflow(design.xstateConfig, req.trigger.startState, req.context ?? {}, runtime, objectCtx)
      const actor = createActor(machine)
      let liveSnapshot: AnyMachineSnapshot
      let persistedSnapshot: AnyMachineSnapshot
      try {
        actor.start()
        await settlePromises(promises)
        liveSnapshot = actor.getSnapshot()
        persistedSnapshot = actor.getPersistedSnapshot() as AnyMachineSnapshot
      } finally {
        actor.stop()
      }

      const state: PersistedState = {
        schemaVersion: 1,
        snapshot: persistedSnapshot,
        config: design.xstateConfig,
        context: { ...req.context ?? {}, __runtime: runtime },
        subscriptions: {}
      }
      await maybeCreateUserTask(objectCtx, machine, liveSnapshot, state)
      await updateInstanceStatus(objectCtx, liveSnapshot, req.namespace)
      await saveState(objectCtx, state)
      return liveSnapshot
    },

    send: async (objectCtx: restate.ObjectContext, req: SendWorkflowRequest) => {
      const state = await loadState(objectCtx)
      if (!state) {
        throw new restate.TerminalError('Workflow instance not found', { errorCode: 404 })
      }

      const { snapshot: rawSnapshot, context } = await runTransition(objectCtx, state, {
        type: req.event,
        record: req.record
      })
      const snapshot = snapshotWithContext(rawSnapshot, context)

      await saveState(objectCtx, { snapshot, context })

      return snapshot
    },

    subscribe: async (
      objectCtx: restate.ObjectContext,
      req: { condition: Condition; awakeableId: string }
    ) => {
      const state = await loadState(objectCtx)
      if (!state) {
        throw new restate.TerminalError('Workflow instance not found', { errorCode: 404 })
      }

      if (evaluateCondition(state.snapshot, req.condition)) {
        objectCtx.resolveAwakeable(req.awakeableId, state.snapshot)
        return
      }

      await registerSubscription(objectCtx, req.condition, req.awakeableId)
    },

    unsubscribe: async (
      objectCtx: restate.ObjectContext,
      req: { awakeableId: string }
    ) => {
      const state = await loadState(objectCtx)
      if (!state) return

      let dirty = false
      for (const [condition, subscription] of Object.entries(state.subscriptions)) {
        const idx = subscription?.awakeables.indexOf(req.awakeableId) ?? -1
        if (idx !== -1) {
          subscription!.awakeables.splice(idx, 1)
          if (subscription!.awakeables.length === 0) {
            delete state.subscriptions[condition as Condition]
          }
          dirty = true
        }
      }

      if (dirty) {
        objectCtx.set('state', state)
      }
    },

    waitFor: restate.handlers.object.shared(
      async (ctx: restate.ObjectSharedContext, req: WaitForWorkflowRequest) => {
        const state = await loadState(ctx)
        if (!state) {
          throw new restate.TerminalError('Workflow instance not found', { errorCode: 404 })
        }

        if (evaluateCondition(state.snapshot, req.condition as Condition)) {
          return state.snapshot
        }

        const { id, promise } = ctx.awakeable<AnyMachineSnapshot>()

        if (req.event) {
          ctx.objectSendClient(workflowObject, ctx.key).send({ event: req.event })
        }

        ctx.objectSendClient(workflowObject, ctx.key).subscribe({
          condition: req.condition as Condition,
          awakeableId: id
        })

        try {
          if (req.timeout !== undefined) {
            return await promise.orTimeout(req.timeout)
          }
          return await promise
        } catch (err) {
          ctx.objectSendClient(workflowObject, ctx.key).unsubscribe({ awakeableId: id })
          throw err
        }
      }
    ),

    snapshot: async (objectCtx: restate.ObjectContext) => {
      const state = await loadState(objectCtx)
      if (!state) {
        throw new restate.TerminalError('Workflow instance not found', { errorCode: 404 })
      }
      return state.snapshot
    }
  }
})
