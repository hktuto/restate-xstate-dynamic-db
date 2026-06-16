import { describe, it, expect } from 'vitest'
import { runtimeGuards } from '../src/runtime/guards.js'

describe('condition guard', () => {
  it('evaluates a mongo-style expression', () => {
    const result = runtimeGuards.condition.evaluate({
      event: { type: 'create' },
      context: { record: { status: 'active' } },
      record: { status: 'active' },
      params: {
        expression: { $eq: ['$context.record.status', 'active'] }
      }
    })
    expect(result).toBe(true)
  })
})
