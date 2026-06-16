import { describe, it, expect, vi } from 'vitest'
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
})

describe('createGuardRegistry', () => {
  it('registers the condition guard', () => {
    const { guards } = createGuardRegistry({ record: { status: 'active' }, tableName: 'members' })
    expect(guards.condition).toBeDefined()
  })
})
