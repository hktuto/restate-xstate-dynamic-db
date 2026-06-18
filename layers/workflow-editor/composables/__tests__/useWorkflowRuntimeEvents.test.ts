import { describe, it, expect } from 'vitest'
import { useWorkflowRuntimeEvents } from '../useWorkflowRuntimeEvents.js'

describe('useWorkflowRuntimeEvents', () => {
  const { getResultEvents, isEventAllowed, defaultEvent } = useWorkflowRuntimeEvents()

  it('returns ok/error for action states', () => {
    expect(getResultEvents('action', { kind: 'action', actionId: 'getRecord', params: {}, outputKey: 'company' }))
      .toEqual(['ok', 'error'])
  })

  it('returns true/false for condition states', () => {
    expect(getResultEvents('condition', { kind: 'condition', expression: {} }))
      .toEqual(['true', 'false'])
  })

  it('returns true/false when actionId is condition', () => {
    expect(getResultEvents('action', { kind: 'action', actionId: 'condition', params: { expression: {} }, outputKey: '' }))
      .toEqual(['true', 'false'])
  })

  it('allows any non-empty event for task states', () => {
    expect(isEventAllowed('task', { kind: 'task', taskType: 'approval', taskInstructions: '' }, 'acknowledged')).toBe(true)
  })

  it('picks first unused default event', () => {
    expect(defaultEvent('action', { kind: 'action', actionId: 'getRecord', params: {}, outputKey: '' }, [])).toBe('ok')
    expect(defaultEvent('action', { kind: 'action', actionId: 'getRecord', params: {}, outputKey: '' }, ['ok'])).toBe('error')
  })
})
