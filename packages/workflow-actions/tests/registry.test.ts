import { describe, it, expect, vi } from 'vitest'
import { createActor, waitFor } from 'xstate'
import { createActionActors, createGuardRegistry } from '../src/runtime/index.js'

describe('createActionActors', () => {
  it('returns an actor for every runtime action', () => {
    const run = vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn())
    const { actors } = createActionActors({ run }, { record: {}, tableName: 'members' })
    expect(actors.getRecord).toBeDefined()
    expect(actors.createRecord).toBeDefined()
    expect(actors.updateRecord).toBeDefined()
    expect(actors.deleteRecord).toBeDefined()
    expect(actors.condition).toBeDefined()
  })

  it('invoking an actor returns { data, outputKey } and calls objectCtx.run with the action id', async () => {
    const run = vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn())
    const { actors } = createActionActors({ run }, { record: {}, tableName: 'members' })

    const actor = createActor(actors.condition, {
      input: {
        outputKey: 'myOutput',
        context: { status: 'active' },
        event: {},
        params: { expression: { $eq: ['$context.status', 'active'] } }
      }
    })
    actor.start()

    const snapshot = await waitFor(actor, (s) => s.status === 'done')

    expect(run).toHaveBeenCalledWith('condition', expect.any(Function))
    expect(snapshot.output).toEqual({ data: true, outputKey: 'myOutput' })
  })
})

describe('createGuardRegistry', () => {
  it('registers the condition guard', () => {
    const { guards } = createGuardRegistry({
      record: { status: 'active' },
      config: { id: 'test', initial: 'idle', states: {} }
    })
    expect(guards.condition).toBeDefined()
  })

  it('evaluates the guard using per-transition params', () => {
    const { guards } = createGuardRegistry({
      record: { status: 'active' },
      config: { id: 'test', initial: 'idle', states: {} }
    })

    const result = guards.condition(
      { context: { status: 'active' }, event: {} },
      { expression: { $eq: ['$context.status', 'active'] } }
    )

    expect(result).toBe(true)
  })
})
