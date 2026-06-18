import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { WorkflowDefinition } from 'shared'
import { useWorkflowEditor } from '../useWorkflowEditor.js'

const emptyDef: WorkflowDefinition = { id: 'test', initial: '', states: {} }

describe('useWorkflowEditor', () => {
  it('adds an action node', () => {
    const { nodes, addNode } = useWorkflowEditor({ definition: ref(emptyDef) })
    addNode('action', { x: 10, y: 20 })
    expect(nodes.value).toHaveLength(1)
    expect(nodes.value[0].type).toBe('action')
    expect(nodes.value[0].data.kind).toBe('action')
  })

  it('adds a transition with the default event', () => {
    const editor = useWorkflowEditor({ definition: ref(emptyDef) })
    editor.addNode('action', { x: 0, y: 0 })
    editor.addNode('final', { x: 200, y: 0 })
    const actionId = editor.nodes.value[0].id
    const finalId = editor.nodes.value[1].id
    editor.addTransition(actionId, finalId)
    expect(editor.edges.value[0].label).toBe('ok')
  })

  it('renames a node and updates edges', () => {
    const editor = useWorkflowEditor({ definition: ref(emptyDef) })
    editor.addNode('action', { x: 0, y: 0 })
    const oldId = editor.nodes.value[0].id
    editor.renameNode(oldId, 'fetchUser')
    expect(editor.nodes.value[0].id).toBe('fetchUser')
  })
})
