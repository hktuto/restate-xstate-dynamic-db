import { describe, it, expect, vi } from 'vitest'
import { createActor } from 'xstate'
import type { ObjectContext } from '@restatedev/restate-sdk'
import type { WorkflowDefinition } from 'shared'
import { compileWorkflow } from '../src/compile.js'

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

    const { machine } = compileWorkflow(definition, {
      instanceId: 'inst-1',
      record: { id: '1', status: 'active' },
      tableName: 'members',
      namespace: 'ns-1'
    }, fakeCtx())

    const actor = createActor(machine)
    actor.subscribe((snapshot) => {
      if (snapshot.status === 'done' && (snapshot.value as any) === 'activeBranch') {
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

    const { machine } = compileWorkflow(definition, {
      instanceId: 'inst-1',
      record: { id: '1', status: 'inactive' },
      tableName: 'members',
      namespace: 'ns-1'
    }, fakeCtx())

    const actor = createActor(machine)
    actor.subscribe((snapshot) => {
      if (snapshot.status === 'done' && (snapshot.value as any) === 'inactiveBranch') {
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

    const { machine } = compileWorkflow(definition, {
      instanceId: 'inst-1',
      record: { id: '1' },
      tableName: 'members',
      namespace: 'ns-1'
    }, fakeCtxRejecting('getRecord'))

    const actor = createActor(machine)
    actor.subscribe((snapshot) => {
      if (snapshot.status === 'done' && (snapshot.value as any) === 'failed') {
        expect((snapshot.context as any).lastError).toEqual({ message: 'action failed' })
        done()
      }
    })
    actor.start()
  }))
})
