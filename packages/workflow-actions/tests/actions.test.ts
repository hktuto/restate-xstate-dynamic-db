import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('db/client', () => ({
  getSurreal: vi.fn(),
  closeSurreal: vi.fn()
}))

import { getSurreal, closeSurreal } from 'db/client'
import { runtimeActions } from '../src/runtime/actions.js'

function mockSurreal(queryResult: unknown) {
  const query = vi.fn().mockResolvedValue(queryResult)
  ;(getSurreal as any).mockResolvedValue({ query })
  return query
}

const baseCtx = {
  event: { type: 'create' },
  context: { record: { id: 'rec-1' }, tableName: 'members', namespace: 'ns-1' },
  record: { id: 'rec-1' },
  tableName: 'members',
  namespace: 'ns-1',
  companyId: 'co-1'
}

describe('getRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the first matching record', async () => {
    mockSurreal([[{ id: 'members:1', status: 'active' }]])
    const result = await runtimeActions.getRecord.execute({
      ...baseCtx,
      params: { table: 'members', filter: { status: { $eq: 'active' } }, result: { type: 'first' } }
    })
    expect(result).toEqual({ id: 'members:1', status: 'active' })
  })

  it('returns a list of records', async () => {
    mockSurreal([[{ id: 'members:1' }, { id: 'members:2' }]])
    const result = await runtimeActions.getRecord.execute({
      ...baseCtx,
      params: { table: 'members', filter: {}, result: { type: 'list' } }
    })
    expect(Array.isArray(result)).toBe(true)
    expect((result as any[]).length).toBe(2)
  })
})

describe('createRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a record and returns it', async () => {
    mockSurreal([[{ id: 'members:new' }]])
    const result = await runtimeActions.createRecord.execute({
      ...baseCtx,
      params: { table: 'members', fields: { email: 'a@b.com' } }
    })
    expect(result).toEqual({ id: 'members:new' })
  })
})

describe('updateRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates by explicit id', async () => {
    mockSurreal([[{ id: 'members:1', status: 'active' }]])
    const result = await runtimeActions.updateRecord.execute({
      ...baseCtx,
      params: { table: 'members', id: 'members:1', fields: { status: 'active' } }
    })
    expect(result).toEqual({ id: 'members:1', status: 'active' })
  })

  it('falls back to context.record.id', async () => {
    mockSurreal([[{ id: 'rec-1', status: 'active' }]])
    const result = await runtimeActions.updateRecord.execute({
      ...baseCtx,
      params: { table: 'members', fields: { status: 'active' } }
    })
    expect(result).toEqual({ id: 'rec-1', status: 'active' })
  })
})

describe('deleteRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes by default', async () => {
    mockSurreal([[{ id: 'rec-1', status: 'deleted' }]])
    const result = await runtimeActions.deleteRecord.execute({
      ...baseCtx,
      params: { table: 'members', id: 'rec-1' }
    })
    expect(result).toEqual({ id: 'rec-1', status: 'deleted' })
  })

  it('hard-deletes when mode is hard', async () => {
    const query = mockSurreal([])
    await runtimeActions.deleteRecord.execute({
      ...baseCtx,
      params: { table: 'members', id: 'rec-1', mode: 'hard' }
    })
    expect(query).toHaveBeenCalledWith('DELETE type::record($id)', { id: 'rec-1' })
  })
})
