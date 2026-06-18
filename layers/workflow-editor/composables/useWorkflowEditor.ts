import { ref, type Ref } from 'vue'
import type { WorkflowDefinition } from 'shared'
import type { EditorEdge, EditorNode } from './types.js'
import { useWorkflowGraph } from './useWorkflowGraph.js'
import { useWorkflowRuntimeEvents } from './useWorkflowRuntimeEvents.js'

export type EditorTool = 'select' | 'pan' | 'add-action' | 'add-condition' | 'add-task' | 'add-final'

export interface UseWorkflowEditorOptions {
  definition: Ref<WorkflowDefinition>
  readonly?: boolean
}

const START_NODE_ID = '__start'
let idCounter = 0

function uniqueId(prefix: string, nodes: EditorNode[]): string {
  let n = ++idCounter
  let candidate = `${prefix}${n}`
  while (nodes.some(node => node.id === candidate)) {
    candidate = `${prefix}${++n}`
  }
  return candidate
}

export function useWorkflowEditor(options: UseWorkflowEditorOptions) {
  const { definition, readonly } = options
  const { definitionToGraph, graphToDefinition } = useWorkflowGraph()
  const { defaultEvent } = useWorkflowRuntimeEvents()

  const nodes = ref<EditorNode[]>([])
  const edges = ref<EditorEdge[]>([])
  const selectedId = ref<string | null>(null)
  const tool = ref<EditorTool>('select')

  function load(def: WorkflowDefinition) {
    const graph = definitionToGraph(def)
    nodes.value = graph.nodes
    edges.value = graph.edges
  }

  function build(): WorkflowDefinition {
    return graphToDefinition(nodes.value, edges.value, definition.value)
  }

  function addNode(type: EditorNode['type'], position: { x: number; y: number }) {
    if (readonly) return
    if (type === 'start') return

    const id = uniqueId(
      type === 'final' ? 'done' : type,
      nodes.value
    )

    let data: EditorNode['data']
    if (type === 'final') data = { kind: 'final' }
    else if (type === 'condition') data = { kind: 'condition', expression: null }
    else if (type === 'task') data = { kind: 'task', taskType: 'manual', taskInstructions: '' }
    else data = { kind: 'action', actionId: '', params: {}, outputKey: '' }

    nodes.value.push({ id, type, position, data })
  }

  function removeNode(id: string) {
    if (readonly || id === START_NODE_ID) return
    nodes.value = nodes.value.filter(n => n.id !== id)
    edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
    if (selectedId.value === id) selectedId.value = null
  }

  function addTransition(source: string, target: string) {
    if (readonly) return
    const sourceNode = nodes.value.find(n => n.id === source)
    const targetNode = nodes.value.find(n => n.id === target)
    if (!sourceNode || !targetNode) return
    if (sourceNode.type === 'final') return

    const used = edges.value.filter(e => e.source === source).map(e => e.label)
    const event = defaultEvent(sourceNode, used)
    if (!event) return
    if (used.includes(event)) return

    const id = `${source}->${target}:${event}`
    if (edges.value.some(e => e.id === id)) return
    edges.value.push({ id, source, target, label: event })
  }

  function removeEdge(id: string) {
    if (readonly) return
    edges.value = edges.value.filter(e => e.id !== id)
    if (selectedId.value === id) selectedId.value = null
  }

  function renameNode(oldId: string, newId: string) {
    if (readonly || oldId === START_NODE_ID) return
    const trimmed = newId.trim()
    if (!trimmed || nodes.value.some(n => n.id === trimmed)) return
    const node = nodes.value.find(n => n.id === oldId)
    if (!node) return
    node.id = trimmed
    for (const edge of edges.value) {
      if (edge.source === oldId) edge.source = trimmed
      if (edge.target === oldId) edge.target = trimmed
      if (edge.id.includes(oldId)) edge.id = `${edge.source}->${edge.target}:${edge.label}`
    }
    if (selectedId.value === oldId) selectedId.value = trimmed
  }

  function updateNodeData(id: string, data: Partial<EditorNode['data']>) {
    if (readonly) return
    const node = nodes.value.find(n => n.id === id)
    if (!node) return
    node.data = { ...node.data, ...data } as EditorNode['data']
  }

  function updateEdgeEvent(id: string, event: string) {
    if (readonly) return
    const edge = edges.value.find(e => e.id === id)
    if (!edge) return
    edge.label = event
    edge.id = `${edge.source}->${edge.target}:${event}`
  }

  return {
    nodes,
    edges,
    selectedId,
    tool,
    load,
    build,
    addNode,
    removeNode,
    addTransition,
    removeEdge,
    renameNode,
    updateNodeData,
    updateEdgeEvent
  }
}
