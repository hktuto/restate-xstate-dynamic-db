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

describe('error handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when namespace is missing', async () => {
    await expect(
      runtimeActions.getRecord.execute({ ...baseCtx, namespace: undefined as any })
    ).rejects.toThrow('namespace is required for CRUD actions')
  })

  it('throws when updateRecord has no id and no context.record.id', async () => {
    await expect(
      runtimeActions.updateRecord.execute({
        ...baseCtx,
        context: {},
        record: undefined as any,
        params: { table: 'members', fields: { status: 'active' } }
      })
    ).rejects.toThrow('updateRecord requires an id or context.record.id')
  })

  it('throws when deleteRecord has no id and no context.record.id', async () => {
    await expect(
      runtimeActions.deleteRecord.execute({
        ...baseCtx,
        context: {},
        record: undefined as any,
        params: { table: 'members' }
      })
    ).rejects.toThrow('deleteRecord requires an id or context.record.id')
  })
})

describe('getRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the first matching record', async () => {
    const query = mockSurreal([[{ id: 'members:1', status: 'active' }]])
    const result = await runtimeActions.getRecord.execute({
      ...baseCtx,
      params: { table: 'members', filter: { status: { $eq: 'active' } }, result: { type: 'first' } }
    })
    expect(getSurreal).toHaveBeenCalledWith('ns-1', 'main')
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM type::table($table)'),
      { table: 'members', p0: 'active' }
    )
    expect(closeSurreal).toHaveBeenCalled()
    expect(result).toEqual({ id: 'members:1', status: 'active' })
  })

  it('returns a list of records', async () => {
    const query = mockSurreal([[{ id: 'members:1' }, { id: 'members:2' }]])
    const result = await runtimeActions.getRecord.execute({
      ...baseCtx,
      params: { table: 'members', filter: {}, result: { type: 'list' } }
    })
    expect(getSurreal).toHaveBeenCalledWith('ns-1', 'main')
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM type::table($table)'),
      { table: 'members' }
    )
    expect(closeSurreal).toHaveBeenCalled()
    expect(result).toEqual([{ id: 'members:1' }, { id: 'members:2' }])
  })

  it('returns null when resultType is first and no matches exist', async () => {
    mockSurreal([[]])
    const result = await runtimeActions.getRecord.execute({
      ...baseCtx,
      params: { table: 'members', filter: { status: { $eq: 'missing' } }, result: { type: 'first' } }
    })
    expect(getSurreal).toHaveBeenCalledWith('ns-1', 'main')
    expect(closeSurreal).toHaveBeenCalled()
    expect(result).toBeNull()
  })
})

describe('createRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a record and returns it', async () => {
    const query = mockSurreal([[{ id: 'members:new' }]])
    const result = await runtimeActions.createRecord.execute({
      ...baseCtx,
      params: { table: 'members', fields: { email: 'a@b.com' } }
    })
    expect(getSurreal).toHaveBeenCalledWith('ns-1', 'main')
    expect(query).toHaveBeenCalledWith(
      'CREATE type::table($table) CONTENT $data',
      { table: 'members', data: { email: 'a@b.com' } }
    )
    expect(closeSurreal).toHaveBeenCalled()
    expect(result).toEqual({ id: 'members:new' })
  })
})

describe('updateRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates by explicit id', async () => {
    const query = mockSurreal([[{ id: 'members:1', status: 'active' }]])
    const result = await runtimeActions.updateRecord.execute({
      ...baseCtx,
      params: { table: 'members', id: 'members:1', fields: { status: 'active' } }
    })
    expect(getSurreal).toHaveBeenCalledWith('ns-1', 'main')
    expect(query).toHaveBeenCalledWith(
      'UPDATE type::record($id) MERGE $data',
      { id: 'members:1', data: { status: 'active' } }
    )
    expect(closeSurreal).toHaveBeenCalled()
    expect(result).toEqual({ id: 'members:1', status: 'active' })
  })

  it('falls back to context.record.id', async () => {
    const query = mockSurreal([[{ id: 'rec-1', status: 'active' }]])
    const result = await runtimeActions.updateRecord.execute({
      ...baseCtx,
      params: { table: 'members', fields: { status: 'active' } }
    })
    expect(getSurreal).toHaveBeenCalledWith('ns-1', 'main')
    expect(query).toHaveBeenCalledWith(
      'UPDATE type::record($id) MERGE $data',
      { id: 'rec-1', data: { status: 'active' } }
    )
    expect(closeSurreal).toHaveBeenCalled()
    expect(result).toEqual({ id: 'rec-1', status: 'active' })
  })

  it('still calls closeSurreal when query fails', async () => {
    ;(getSurreal as any).mockResolvedValue({
      query: vi.fn().mockRejectedValue(new Error('db down'))
    })
    await expect(
      runtimeActions.updateRecord.execute({
        ...baseCtx,
        params: { table: 'members', id: 'members:1', fields: { status: 'active' } }
      })
    ).rejects.toThrow('db down')
    expect(closeSurreal).toHaveBeenCalled()
  })
})

describe('deleteRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes by default', async () => {
    const query = mockSurreal([[{ id: 'rec-1', status: 'deleted' }]])
    const result = await runtimeActions.deleteRecord.execute({
      ...baseCtx,
      params: { table: 'members', id: 'rec-1' }
    })
    expect(getSurreal).toHaveBeenCalledWith('ns-1', 'main')
    expect(query).toHaveBeenCalledWith(
      'UPDATE type::record($id) SET status = "deleted"',
      { id: 'rec-1' }
    )
    expect(closeSurreal).toHaveBeenCalled()
    expect(result).toEqual({ id: 'rec-1', status: 'deleted' })
  })

  it('hard-deletes when mode is hard', async () => {
    const query = mockSurreal([])
    const result = await runtimeActions.deleteRecord.execute({
      ...baseCtx,
      params: { table: 'members', id: 'rec-1', mode: 'hard' }
    })
    expect(getSurreal).toHaveBeenCalledWith('ns-1', 'main')
    expect(query).toHaveBeenCalledWith('DELETE type::record($id)', { id: 'rec-1' })
    expect(closeSurreal).toHaveBeenCalled()
    expect(result).toEqual({ id: 'rec-1' })
  })
})

describe('condition', () => {
  it('returns true when expression matches context', () => {
    const result = runtimeActions.condition.execute({
      ...baseCtx,
      params: { expression: { $eq: ['$context.record.id', 'rec-1'] } }
    })
    expect(result).toBe(true)
  })

  it('returns false when expression does not match', () => {
    const result = runtimeActions.condition.execute({
      ...baseCtx,
      params: { expression: { $eq: ['$context.record.id', 'other'] } }
    })
    expect(result).toBe(false)
  })
})
