import { describe, it, expect } from 'vitest'
import { normalizeId, normalizeIds } from '../src/normalize.js'

describe('normalize', () => {
  it('returns undefined for undefined', () => {
    expect(normalizeId(undefined)).toBeUndefined()
  })

  it('stringifies a string id', () => {
    const record = { id: 'workflows:abc', name: 'x' }
    expect(normalizeId(record)).toEqual({ id: 'workflows:abc', name: 'x' })
  })

  it('stringifies a RecordId-like object', () => {
    const record = { id: { toString: () => 'workflows:abc' }, name: 'x' }
    expect(normalizeId(record)!.id).toBe('workflows:abc')
  })

  it('normalizes an array of records', () => {
    const records = [
      { id: 'members:1', name: 'a' },
      { id: 'members:2', name: 'b' },
    ]
    expect(normalizeIds(records)).toEqual(records)
  })
})
