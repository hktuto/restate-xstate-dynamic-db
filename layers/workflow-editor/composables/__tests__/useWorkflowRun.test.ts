import { describe, it, expect, vi } from 'vitest'
import { useWorkflowRun } from '../useWorkflowRun.js'

vi.mock('workflow-actions/catalog/resolve-inputs', () => ({
  resolveInputs: vi.fn(async (_ns: string, _def: unknown, stateId: string) => {
    if (stateId === 'form') {
      return [
        { name: 'email', label: 'Email', dbType: 'string', displayType: 'email', required: true },
        { name: 'count', label: 'Count', dbType: 'number', displayType: 'number' },
        { name: 'secret', label: 'Secret', dbType: 'string', displayType: 'text', hidden: true }
      ]
    }
    return []
  })
}))

describe('useWorkflowRun', () => {
  it('returns visible inputs excluding hidden', async () => {
    const { visibleInputs } = await useWorkflowRun('test', { id: 'w', initial: 'form', states: {} }, 'form')
    expect(visibleInputs.value.map((i) => i.name)).toEqual(['email', 'count'])
  })
})
