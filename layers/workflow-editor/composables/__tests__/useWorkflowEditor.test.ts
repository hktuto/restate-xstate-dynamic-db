import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { WorkflowDefinition } from 'shared'
import type { EditorEdge, EditorNode } from '../types.js'
import { useWorkflowEditor } from '../useWorkflowEditor.js'

const START_NODE_ID = '__start'

const emptyDef: WorkflowDefinition = { id: 'test', initial: '', states: {} }

function nodeAt(nodes: EditorNode[], index: number): EditorNode {
  const node = nodes[index]
  if (!node) throw new Error(`Expected node at index ${index}`)
  return node
}

function edgeAt(edges: EditorEdge[], index: number): EditorEdge {
  const edge = edges[index]
  if (!edge) throw new Error(`Expected edge at index ${index}`)
  return edge
}

describe('useWorkflowEditor', () => {
  it('adds an action node', () => {
    const { nodes, addNode } = useWorkflowEditor({ definition: ref(emptyDef) })
    addNode('action', { x: 10, y: 20 })
    expect(nodes.value).toHaveLength(2)
    const node = nodeAt(nodes.value, 1)
    expect(node.type).toBe('action')
    expect(node.data.kind).toBe('action')
  })

  it('adds a transition with the default event', () => {
    const editor = useWorkflowEditor({ definition: ref(emptyDef) })
    editor.addNode('action', { x: 0, y: 0 })
    editor.addNode('final', { x: 200, y: 0 })
    const actionId = nodeAt(editor.nodes.value, 1).id
    const finalId = nodeAt(editor.nodes.value, 2).id
    editor.addTransition(actionId, finalId)
    expect(editor.edges.value).toHaveLength(1)
    expect(edgeAt(editor.edges.value, 0).label).toBe('ok')
  })

  it('renames a node and updates edges', () => {
    const editor = useWorkflowEditor({ definition: ref(emptyDef) })
    editor.addNode('action', { x: 0, y: 0 })
    const oldId = nodeAt(editor.nodes.value, 1).id
    editor.renameNode(oldId, 'fetchUser')
    expect(nodeAt(editor.nodes.value, 1).id).toBe('fetchUser')
  })

  it('removeNode removes the node and its connected edges', () => {
    const editor = useWorkflowEditor({ definition: ref(emptyDef) })
    editor.addNode('action', { x: 0, y: 0 })
    editor.addNode('final', { x: 200, y: 0 })
    const actionId = nodeAt(editor.nodes.value, 1).id
    const finalId = nodeAt(editor.nodes.value, 2).id
    editor.addTransition(actionId, finalId)
    editor.removeNode(actionId)
    expect(editor.nodes.value).toHaveLength(2)
    expect(editor.nodes.value.some(n => n.id === actionId)).toBe(false)
    expect(editor.edges.value).toHaveLength(0)
    expect(editor.nodes.value.some(n => n.id === finalId)).toBe(true)
  })

  it('updateNodeData updates the node data', () => {
    const editor = useWorkflowEditor({ definition: ref(emptyDef) })
    editor.addNode('action', { x: 0, y: 0 })
    const actionId = nodeAt(editor.nodes.value, 1).id
    editor.updateNodeData(actionId, {
      kind: 'action',
      actionId: 'sendEmail',
      outputKey: 'result'
    })
    const node = nodeAt(editor.nodes.value, 1)
    expect(node.data.kind).toBe('action')
    if (node.data.kind !== 'action') throw new Error('expected action node')
    expect(node.data.actionId).toBe('sendEmail')
    expect(node.data.outputKey).toBe('result')
  })

  it('updateEdgeEvent renames an edge and syncs selection', () => {
    const editor = useWorkflowEditor({ definition: ref(emptyDef) })
    editor.addNode('action', { x: 0, y: 0 })
    editor.addNode('final', { x: 200, y: 0 })
    const actionId = nodeAt(editor.nodes.value, 1).id
    const finalId = nodeAt(editor.nodes.value, 2).id
    editor.addTransition(actionId, finalId)
    const oldEdgeId = edgeAt(editor.edges.value, 0).id
    editor.selectedId.value = oldEdgeId
    editor.updateEdgeEvent(oldEdgeId, 'done')
    const edge = edgeAt(editor.edges.value, 0)
    expect(edge.label).toBe('done')
    expect(edge.id).toBe(`${actionId}->${finalId}:done`)
    expect(editor.selectedId.value).toBe(`${actionId}->${finalId}:done`)
  })

  it('build produces a WorkflowDefinition with the correct initial state', () => {
    const def: WorkflowDefinition = {
      id: 'wf',
      initial: 'a',
      states: { a: {}, b: {} }
    }
    const editor = useWorkflowEditor({ definition: ref(def) })
    const built = editor.build()
    expect(built.id).toBe('wf')
    expect(built.initial).toBe('a')
    expect(built.states).toHaveProperty('a')
    expect(built.states).toHaveProperty('b')
  })

  it('load initializes nodes/edges from a definition', () => {
    const def: WorkflowDefinition = {
      id: 'wf',
      initial: 'a',
      states: {
        a: { on: { ok: { target: 'b' } } },
        b: {}
      }
    }
    const editor = useWorkflowEditor({ definition: ref(def) })
    const ids = editor.nodes.value.map(n => n.id)
    expect(ids).toEqual(expect.arrayContaining([START_NODE_ID, 'a', 'b']))
    expect(editor.edges.value).toHaveLength(2)
    expect(editor.edges.value.map(e => e.id)).toEqual(
      expect.arrayContaining([`${START_NODE_ID}->a:start`, 'a->b:ok'])
    )
  })

  it('readonly prevents mutations', () => {
    const def: WorkflowDefinition = {
      id: 'wf',
      initial: 'a',
      states: { a: {}, b: {} }
    }
    const editor = useWorkflowEditor({ definition: ref(def), readonly: true })
    const originalNodeCount = editor.nodes.value.length
    const originalEdgeCount = editor.edges.value.length
    const nodeA = editor.nodes.value.find(n => n.id === 'a')!

    editor.addNode('action', { x: 0, y: 0 })
    editor.removeNode('a')
    editor.renameNode('a', 'renamed')
    editor.updateNodeData('a', { kind: 'action', actionId: 'x' })
    editor.addTransition('a', 'b')
    editor.removeEdge(`${START_NODE_ID}->a:start`)
    editor.updateEdgeEvent(`${START_NODE_ID}->a:start`, 'x')

    expect(editor.nodes.value).toHaveLength(originalNodeCount)
    expect(editor.edges.value).toHaveLength(originalEdgeCount)
    expect(nodeA.id).toBe('a')
  })

  it('renameNode propagates to edges (assert edge source/target/id updated)', () => {
    const editor = useWorkflowEditor({ definition: ref(emptyDef) })
    editor.addNode('action', { x: 0, y: 0 })
    editor.addNode('final', { x: 200, y: 0 })
    const actionId = nodeAt(editor.nodes.value, 1).id
    const finalId = nodeAt(editor.nodes.value, 2).id
    editor.addTransition(actionId, finalId)

    editor.renameNode(actionId, 'fetchUser')
    editor.renameNode(finalId, 'end')

    expect(editor.nodes.value.some(n => n.id === 'fetchUser')).toBe(true)
    expect(editor.nodes.value.some(n => n.id === 'end')).toBe(true)
    const edge = edgeAt(editor.edges.value, 0)
    expect(edge.source).toBe('fetchUser')
    expect(edge.target).toBe('end')
    expect(edge.id).toBe('fetchUser->end:ok')
  })
})
