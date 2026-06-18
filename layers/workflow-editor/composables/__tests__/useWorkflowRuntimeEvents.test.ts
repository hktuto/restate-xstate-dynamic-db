import { describe, it, expect } from 'vitest'
import { useWorkflowRuntimeEvents } from '../useWorkflowRuntimeEvents.js'
import type { EditorNode, EditorNodeData, EditorNodeType } from '../types.js'

function makeNode<T extends EditorNodeType>(
  type: T,
  data: Extract<EditorNodeData, { kind: T }>,
  position?: { x: number; y: number }
): EditorNode {
  return { id: `${type}-1`, type, position: position ?? { x: 0, y: 0 }, data }
}

describe('useWorkflowRuntimeEvents', () => {
  const { getResultEvents, isEventAllowed, defaultEvent } = useWorkflowRuntimeEvents()

  it('returns start for start states', () => {
    expect(getResultEvents(makeNode('start', { kind: 'start' }))).toEqual(['start'])
  })

  it('returns empty for final states', () => {
    expect(getResultEvents(makeNode('final', { kind: 'final' }))).toEqual([])
  })

  it('returns ok/error for action states', () => {
    expect(getResultEvents(makeNode('action', { kind: 'action', actionId: 'getRecord', params: {}, outputKey: 'company' })))
      .toEqual(['ok', 'error'])
  })

  it('returns true/false for condition states', () => {
    expect(getResultEvents(makeNode('condition', { kind: 'condition', expression: {} })))
      .toEqual(['true', 'false'])
  })

  it('returns true/false when actionId is condition', () => {
    expect(getResultEvents(makeNode('action', { kind: 'action', actionId: 'condition', params: { expression: {} }, outputKey: '' })))
      .toEqual(['true', 'false'])
  })

  it('allows any non-empty event for task states', () => {
    expect(isEventAllowed(makeNode('task', { kind: 'task', taskType: 'approval', taskInstructions: '' }), 'acknowledged')).toBe(true)
  })

  it('rejects invalid events for action states', () => {
    expect(isEventAllowed(makeNode('action', { kind: 'action', actionId: 'getRecord', params: {}, outputKey: '' }), 'invalid')).toBe(false)
  })

  it('rejects invalid events for condition action states', () => {
    expect(isEventAllowed(makeNode('action', { kind: 'action', actionId: 'condition', params: {}, outputKey: '' }), 'ok')).toBe(false)
  })

  it('allows start from start nodes and rejects other events', () => {
    expect(isEventAllowed(makeNode('start', { kind: 'start' }), 'start')).toBe(true)
    expect(isEventAllowed(makeNode('start', { kind: 'start' }), 'ok')).toBe(false)
  })

  it('picks first unused default event', () => {
    expect(defaultEvent(makeNode('action', { kind: 'action', actionId: 'getRecord', params: {}, outputKey: '' }), [])).toBe('ok')
    expect(defaultEvent(makeNode('action', { kind: 'action', actionId: 'getRecord', params: {}, outputKey: '' }), ['ok'])).toBe('error')
  })

  it('falls back to the first candidate when all candidates are used', () => {
    expect(defaultEvent(makeNode('action', { kind: 'action', actionId: 'getRecord', params: {}, outputKey: '' }), ['ok', 'error'])).toBe('ok')
  })

  it('returns null for default event of final nodes', () => {
    expect(defaultEvent(makeNode('final', { kind: 'final' }), [])).toBe(null)
  })
})
