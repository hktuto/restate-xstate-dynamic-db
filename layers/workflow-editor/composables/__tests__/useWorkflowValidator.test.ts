import { describe, it, expect } from 'vitest'
import type { EditorEdge, EditorNode } from '../types.js'
import { useWorkflowValidator } from '../useWorkflowValidator.js'

describe('useWorkflowValidator', () => {
  const { validate } = useWorkflowValidator()

  it('flags missing start node', () => {
    const errors = validate([], [])
    expect(errors.some(e => e.path === 'start')).toBe(true)
  })

  it('flags final state with outgoing transition', () => {
    const nodes: EditorNode[] = [
      { id: '__start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
      { id: 'a', type: 'final', position: { x: 0, y: 0 }, data: { kind: 'final' } }
    ]
    const edges: EditorEdge[] = [
      { id: '__start->a:start', source: '__start', target: 'a', label: 'start' },
      { id: 'a->a:loop', source: 'a', target: 'a', label: 'loop' }
    ]
    const errors = validate(nodes, edges)
    expect(errors.some(e => e.message.includes('Final states cannot have outgoing'))).toBe(true)
  })

  it('flags invalid event from action state', () => {
    const nodes: EditorNode[] = [
      { id: '__start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
      { id: 'a', type: 'action', position: { x: 0, y: 0 }, data: { kind: 'action', actionId: 'getRecord', params: {}, outputKey: '' } },
      { id: 'b', type: 'final', position: { x: 0, y: 0 }, data: { kind: 'final' } }
    ]
    const edges: EditorEdge[] = [
      { id: '__start->a:start', source: '__start', target: 'a', label: 'start' },
      { id: 'a->b:approved', source: 'a', target: 'b', label: 'approved' }
    ]
    const errors = validate(nodes, edges)
    expect(errors.some(e => e.message.includes('not allowed'))).toBe(true)
  })
})
