import { describe, it, expect } from 'vitest'
import type { EditorEdge, EditorNode } from '../types.js'
import { useWorkflowValidator } from '../useWorkflowValidator.js'

describe('useWorkflowValidator', () => {
  const { validate } = useWorkflowValidator()

  it('flags missing start node', () => {
    const errors = validate([], [])
    expect(errors).toContainEqual({
      id: '__start',
      path: 'start',
      message: 'Exactly one Start node is required'
    })
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
    expect(errors).toContainEqual({
      id: 'a->b:approved',
      path: 'edges.a->b:approved.event',
      message: 'Event "approved" is not allowed from state "a"'
    })
  })

  it('flags a dangling source edge', () => {
    const nodes: EditorNode[] = [
      { id: '__start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
      { id: 'a', type: 'final', position: { x: 0, y: 0 }, data: { kind: 'final' } }
    ]
    const edges: EditorEdge[] = [
      { id: '__start->a:start', source: '__start', target: 'a', label: 'start' },
      { id: 'missing->a:foo', source: 'missing', target: 'a', label: 'foo' }
    ]
    const errors = validate(nodes, edges)
    expect(errors).toContainEqual({
      id: 'missing->a:foo',
      path: 'edges.missing->a:foo.source',
      message: 'Transition sources missing state "missing"'
    })
  })

  it('flags an empty condition expression', () => {
    const nodes: EditorNode[] = [
      { id: '__start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
      { id: 'c', type: 'condition', position: { x: 0, y: 0 }, data: { kind: 'condition', expression: '' } },
      { id: 'a', type: 'final', position: { x: 0, y: 0 }, data: { kind: 'final' } }
    ]
    const edges: EditorEdge[] = [
      { id: '__start->c:start', source: '__start', target: 'c', label: 'start' },
      { id: 'c->a:true', source: 'c', target: 'a', label: 'true' }
    ]
    const errors = validate(nodes, edges)
    expect(errors).toContainEqual({
      id: 'c',
      path: 'nodes.c.expression',
      message: 'Condition state "c" must have an expression'
    })
  })

  it('flags a missing actionId on an action state', () => {
    const nodes: EditorNode[] = [
      { id: '__start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
      { id: 'act', type: 'action', position: { x: 0, y: 0 }, data: { kind: 'action', actionId: '', params: {}, outputKey: '' } },
      { id: 'a', type: 'final', position: { x: 0, y: 0 }, data: { kind: 'final' } }
    ]
    const edges: EditorEdge[] = [
      { id: '__start->act:start', source: '__start', target: 'act', label: 'start' },
      { id: 'act->a:ok', source: 'act', target: 'a', label: 'ok' }
    ]
    const errors = validate(nodes, edges)
    expect(errors).toContainEqual({
      id: 'act',
      path: 'nodes.act.action',
      message: 'Action state "act" must select an action'
    })
  })

  it('flags a missing taskType on a task state', () => {
    const nodes: EditorNode[] = [
      { id: '__start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
      { id: 't', type: 'task', position: { x: 0, y: 0 }, data: { kind: 'task', taskType: '' as any, taskInstructions: '' } },
      { id: 'a', type: 'final', position: { x: 0, y: 0 }, data: { kind: 'final' } }
    ]
    const edges: EditorEdge[] = [
      { id: '__start->t:start', source: '__start', target: 't', label: 'start' },
      { id: 't->a:approved', source: 't', target: 'a', label: 'approved' }
    ]
    const errors = validate(nodes, edges)
    expect(errors).toContainEqual({
      id: 't',
      path: 'nodes.t.taskType',
      message: 'Task state "t" must select a task type'
    })
  })

  it('flags duplicate state ids', () => {
    const nodes: EditorNode[] = [
      { id: '__start', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start' } },
      { id: 'a', type: 'final', position: { x: 0, y: 0 }, data: { kind: 'final' } },
      { id: 'a', type: 'final', position: { x: 0, y: 0 }, data: { kind: 'final' } }
    ]
    const edges: EditorEdge[] = [
      { id: '__start->a:start', source: '__start', target: 'a', label: 'start' }
    ]
    const errors = validate(nodes, edges)
    expect(errors).toContainEqual({
      id: 'a',
      path: 'nodes.a',
      message: 'Duplicate state id "a"'
    })
  })
})
