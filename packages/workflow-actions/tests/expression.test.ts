import { describe, it, expect } from 'vitest'
import { resolveValue, evaluateExpression } from '../src/runtime/expression.js'

describe('resolveValue', () => {
  it('resolves $context refs', () => {
    expect(resolveValue('$context.record.status', { record: { status: 'active' } })).toBe('active')
  })

  it('returns literals', () => {
    expect(resolveValue('active', { record: {} })).toBe('active')
    expect(resolveValue(42, {})).toBe(42)
  })
})

describe('evaluateExpression', () => {
  const context = {
    record: { status: 'active', role: 'owner', tags: ['a', 'b'] }
  }

  it('evaluates $eq', () => {
    expect(evaluateExpression({ $eq: ['$context.record.status', 'active'] }, context)).toBe(true)
    expect(evaluateExpression({ $eq: ['$context.record.status', 'inactive'] }, context)).toBe(false)
  })

  it('evaluates $ne', () => {
    expect(evaluateExpression({ $ne: ['$context.record.status', 'inactive'] }, context)).toBe(true)
  })

  it('evaluates $exists', () => {
    expect(evaluateExpression({ $exists: '$context.record.status' }, context)).toBe(true)
    expect(evaluateExpression({ $exists: '$context.record.missing' }, context)).toBe(false)
  })

  it('evaluates $in', () => {
    expect(evaluateExpression({ $in: ['$context.record.role', ['owner', 'admin']] }, context)).toBe(true)
    expect(evaluateExpression({ $in: ['$context.record.role', ['member']] }, context)).toBe(false)
  })

  it('evaluates $nin', () => {
    expect(evaluateExpression({ $nin: ['$context.record.role', ['member']] }, context)).toBe(true)
  })

  it('evaluates boolean combinators', () => {
    expect(evaluateExpression({
      $and: [
        { $eq: ['$context.record.status', 'active'] },
        { $in: ['$context.record.role', ['owner', 'admin']] }
      ]
    }, context)).toBe(true)

    expect(evaluateExpression({
      $or: [
        { $eq: ['$context.record.status', 'inactive'] },
        { $eq: ['$context.record.role', 'owner'] }
      ]
    }, context)).toBe(true)

    expect(evaluateExpression({
      $not: { $eq: ['$context.record.status', 'active'] }
    }, context)).toBe(false)
  })
})
