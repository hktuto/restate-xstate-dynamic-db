import { describe, it, expect } from 'vitest'
import type { ActionExecutorContext, GuardExecutorContext } from '../src/types.js'

describe('executor contexts', () => {
  it('includes the full machine context', () => {
    const ctx: ActionExecutorContext = {
      event: { type: 'create' },
      context: { record: { id: '1' }, tableName: 'members' },
      record: { id: '1' },
      tableName: 'members',
      params: {}
    }
    expect(ctx.context.record).toEqual({ id: '1' })
  })

  it('guard context includes machine context', () => {
    const ctx: GuardExecutorContext = {
      event: { type: 'create' },
      context: { record: { status: 'active' } },
      record: { status: 'active' },
      params: {}
    }
    expect(ctx.context.record.status).toBe('active')
  })
})
