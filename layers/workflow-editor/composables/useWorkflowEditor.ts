import { ref, type Ref } from 'vue'
import type { WorkflowDefinition } from 'shared'
import type { EditorNode, EditorEdge } from './useWorkflowGraph'
import { useWorkflowGraph } from './useWorkflowGraph'

export type EditorTool = 'select' | 'pan' | 'add-state'

export interface UseWorkflowEditorOptions {
  definition: Ref<WorkflowDefinition>
  readonly?: boolean
}

export function useWorkflowEditor(options: UseWorkflowEditorOptions) {
  const { definition, readonly } = options
  const { definitionToGraph, graphToDefinition } = useWorkflowGraph()

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
    return graphToDefinition(
      nodes.value,
      edges.value,
      definition.value.initial,
      definition.value.id,
      definition.value.context,
      definition.value.meta,
      definition.value.states
    )
  }

  function addState(id: string, position: { x: number; y: number }) {
    if (readonly) return
    if (!id || nodes.value.some(n => n.id === id)) return
    nodes.value.push({
      id,
      type: 'state',
      position,
      data: { label: id, entry: [], exit: [] }
    })
    if (!definition.value.initial) {
      definition.value.initial = id
    }
  }

  function removeState(id: string) {
    if (readonly) return
    nodes.value = nodes.value.filter(n => n.id !== id)
    edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
    if (definition.value.initial === id) {
      definition.value.initial = nodes.value[0]?.id ?? ''
    }
    if (selectedId.value === id) selectedId.value = null
  }

  function addTransition(source: string, target: string, event: string) {
    if (readonly) return
    if (!source || !target || !event) return
    const guardKey = 'no-guard'
    const id = `${source}-${event}-${target}-${guardKey}`
    if (edges.value.some(e => e.id === id)) return
    edges.value.push({ id, source, target, label: event, animated: true })
  }

  function removeEdge(id: string) {
    if (readonly) return
    edges.value = edges.value.filter(e => e.id !== id)
    if (selectedId.value === id) selectedId.value = null
  }

  function renameState(oldId: string, newId: string) {
    if (readonly) return
    if (!newId || nodes.value.some(n => n.id === newId)) return
    const node = nodes.value.find(n => n.id === oldId)
    if (!node) return
    node.id = newId
    node.data.label = newId
    for (const edge of edges.value) {
      if (edge.source === oldId) edge.source = newId
      if (edge.target === oldId) edge.target = newId
    }
    if (definition.value.initial === oldId) {
      definition.value.initial = newId
    }
    if (selectedId.value === oldId) selectedId.value = newId
  }

  function renameEdge(id: string, newLabel: string) {
    if (readonly) return
    const edge = edges.value.find(e => e.id === id)
    if (!edge) return
    edge.label = newLabel
    updateEdgeData(id, edge.data ?? {})
  }

  function updateStateData(id: string, data: Partial<EditorNode['data']>) {
    if (readonly) return
    const node = nodes.value.find(n => n.id === id)
    if (!node) return
    Object.assign(node.data, data)
  }

  function updateEdgeData(id: string, data: Partial<NonNullable<EditorEdge['data']>>) {
    if (readonly) return
    const edge = edges.value.find(e => e.id === id)
    if (!edge) return
    if (!edge.data) edge.data = {}
    Object.assign(edge.data, data)

    const guardKey = edge.data.guard
      ? `${edge.data.guard.type}-${JSON.stringify(edge.data.guard.params ?? {})}`
      : 'no-guard'
    const actionKey = edge.data.actions?.length
      ? `-${JSON.stringify(edge.data.actions)}`
      : ''
    const newId = `${edge.source}-${edge.label}-${edge.target}-${guardKey}${actionKey}`
    if (newId !== edge.id) {
      edge.id = newId
      if (selectedId.value === id) selectedId.value = newId
    }
  }

  return {
    nodes,
    edges,
    selectedId,
    tool,
    load,
    build,
    addState,
    removeState,
    addTransition,
    removeEdge,
    renameState,
    renameEdge,
    updateStateData,
    updateEdgeData
  }
}
