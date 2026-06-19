import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor } from 'xstate'
import type { ObjectContext } from '@restatedev/restate-sdk'
import type { WorkflowDefinition } from 'shared'
import { compileWorkflow } from '../src/compile.js'
import { upsertWorkflowAction } from 'db/workflow-actions'

vi.mock('db/workflow-actions', () => ({
  upsertWorkflowAction: vi.fn().mockResolvedValue({}),
  listWorkflowActionsByInstance: vi.fn().mockResolvedValue([])
}))

function fakeCtx(): Pick<ObjectContext, 'run'> {
  return { run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()) as any }
}

function fakeCtxRejecting(actionId: string): Pick<ObjectContext, 'run'> {
  return {
    run: vi.fn(async (name: string, fn: () => Promise<unknown>) => {
      if (name === actionId) throw new Error('action failed')
      return fn()
    }) as any
  }
}

describe('compileWorkflow with meta actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('runs a condition action and branches true', () => new Promise<void>((done) => {
    const definition: WorkflowDefinition = {
      id: 'test',
      initial: 'check',
      states: {
        check: {
          meta: {
            action: 'condition',
            params: {
              expression: { $eq: ['$context.record.status', 'active'] }
            }
          },
          on: {
            true: { target: 'activeBranch' },
            false: { target: 'inactiveBranch' }
          }
        },
        activeBranch: { type: 'final' },
        inactiveBranch: { type: 'final' }
      }
    }

    const { machine } = compileWorkflow(
      definition,
      definition.initial,
      { record: { id: '1', status: 'active' } },
      { instanceId: 'inst-1', designId: 'design-1', tableName: 'members', namespace: 'ns-1' },
      fakeCtx()
    )

    const actor = createActor(machine)
    actor.subscribe((snapshot) => {
      if (snapshot.status === 'done' && (snapshot.value as any) === 'activeBranch') {
        expect(upsertWorkflowAction).toHaveBeenCalledTimes(2)
        expect(upsertWorkflowAction).toHaveBeenNthCalledWith(
          1,
          'ns-1',
          'inst-1:check',
          expect.objectContaining({ status: 'started' })
        )
        expect(upsertWorkflowAction).toHaveBeenNthCalledWith(
          2,
          'ns-1',
          'inst-1:check',
          expect.objectContaining({ status: 'completed', resultEvent: 'true' })
        )
        done()
      }
    })
    actor.start()
  }))

  it('runs a condition action and branches false', () => new Promise<void>((done) => {
    const definition: WorkflowDefinition = {
      id: 'test',
      initial: 'check',
      states: {
        check: {
          meta: {
            action: 'condition',
            params: {
              expression: { $eq: ['$context.record.status', 'active'] }
            }
          },
          on: {
            true: { target: 'activeBranch' },
            false: { target: 'inactiveBranch' }
          }
        },
        activeBranch: { type: 'final' },
        inactiveBranch: { type: 'final' }
      }
    }

    const { machine } = compileWorkflow(
      definition,
      definition.initial,
      { record: { id: '1', status: 'inactive' } },
      { instanceId: 'inst-1', designId: 'design-1', tableName: 'members', namespace: 'ns-1' },
      fakeCtx()
    )

    const actor = createActor(machine)
    actor.subscribe((snapshot) => {
      if (snapshot.status === 'done' && (snapshot.value as any) === 'inactiveBranch') {
        expect(upsertWorkflowAction).toHaveBeenCalledTimes(2)
        expect(upsertWorkflowAction).toHaveBeenNthCalledWith(
          2,
          'ns-1',
          'inst-1:check',
          expect.objectContaining({ status: 'completed', resultEvent: 'false' })
        )
        done()
      }
    })
    actor.start()
  }))

  it('handles action errors via error event and assigns lastError', () => new Promise<void>((done) => {
    const definition: WorkflowDefinition = {
      id: 'test',
      initial: 'run',
      states: {
        run: {
          meta: {
            action: 'getRecord',
            params: { table: 'members' }
          },
          on: {
            ok: { target: 'done' },
            error: { target: 'failed' }
          }
        },
        done: { type: 'final' },
        failed: { type: 'final' }
      }
    }

    const { machine } = compileWorkflow(
      definition,
      definition.initial,
      { record: { id: '1' } },
      { instanceId: 'inst-1', designId: 'design-1', tableName: 'members', namespace: 'ns-1' },
      fakeCtxRejecting('getRecord')
    )

    const actor = createActor(machine)
    actor.subscribe((snapshot) => {
      if (snapshot.status === 'done' && (snapshot.value as any) === 'failed') {
        expect((snapshot.context as any).lastError).toEqual({ message: 'action failed' })
        done()
      }
    })
    actor.start()
  }))

  it('starts at the overridden startState', () => {
    const definition: WorkflowDefinition = {
      id: 'test',
      initial: 'a',
      states: {
        a: { type: 'final' },
        b: { type: 'final' }
      }
    }
    const { machine } = compileWorkflow(
      definition,
      'b',
      {},
      { instanceId: 'i:1', designId: 'd:1', namespace: 'ns' },
      fakeCtx()
    )
    const actor = createActor(machine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('b')
    actor.stop()
  })

  it('injects __runtime metadata into context', () => {
    const definition: WorkflowDefinition = { id: 'test', initial: 'start', states: { start: { type: 'final' } } }
    const { machine } = compileWorkflow(
      definition,
      'start',
      { foo: 'bar' },
      { instanceId: 'i:1', designId: 'd:1', tableName: 't', companyId: 'c:1', namespace: 'ns' },
      fakeCtx()
    )
    const actor = createActor(machine)
    actor.start()
    const ctx = actor.getSnapshot().context
    expect(ctx.foo).toBe('bar')
    expect(ctx.__runtime).toEqual({
      instanceId: 'i:1',
      designId: 'd:1',
      tableName: 't',
      companyId: 'c:1',
      namespace: 'ns'
    })
    actor.stop()
  })
})
