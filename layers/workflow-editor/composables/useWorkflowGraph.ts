import type { WorkflowDefinition, WorkflowState } from 'shared'
import { CONDITION_ACTION_ID, type EditorEdge, type EditorNode, type EditorNodeType } from './types.js'

const START_NODE_ID = '__start'

function emptyDefinition(id: string): WorkflowDefinition {
  return { id, initial: '', states: {} }
}

function inferNodeType(state: WorkflowState): EditorNodeType {
  if (state.type === 'final') return 'final'
  if (state.tags?.includes('waiting')) return 'task'
  const action = state.meta?.action as string | undefined
  if (action === CONDITION_ACTION_ID) return 'condition'
  if (action) return 'action'
  return 'action'
}

function stateToData(state: WorkflowState): EditorNode['data'] {
  const type = inferNodeType(state)
  if (type === 'final') return { kind: 'final' }
  if (type === 'task') {
    return {
      kind: 'task',
      taskType: (state.meta?.taskType as 'approval' | 'review' | 'manual') ?? 'manual',
      taskInstructions: (state.meta?.taskInstructions as string) ?? ''
    }
  }
  if (type === 'condition') {
    return {
      kind: 'condition',
      expression: (state.meta?.params as Record<string, unknown> | undefined)?.expression ?? null
    }
  }
  const actionId = (state.meta?.action as string) ?? ''
  return {
    kind: 'action',
    actionId,
    params: (state.meta?.params as Record<string, unknown> | undefined) ?? {},
    outputKey: (state.meta?.outputKey as string) ?? ''
  }
}

function dataToState(node: EditorNode): WorkflowState {
  const base: WorkflowState = {}
  if (node.type === 'final') {
    base.type = 'final'
    return base
  }
  if (node.data.kind === 'task') {
    base.tags = ['waiting']
    base.meta = {
      taskType: node.data.taskType,
      taskInstructions: node.data.taskInstructions
    }
    return base
  }
  if (node.data.kind === 'condition') {
    base.meta = {
      action: CONDITION_ACTION_ID,
      params: { expression: node.data.expression }
    }
    return base
  }
  if (node.data.kind === 'action') {
    if (node.data.actionId) {
      base.meta = {
        action: node.data.actionId,
        params: node.data.params,
        outputKey: node.data.outputKey || undefined
      }
    }
    return base
  }
  return base
}

export function useWorkflowGraph() {
  function definitionToGraph(definition: WorkflowDefinition): { nodes: EditorNode[]; edges: EditorEdge[] } {
    const positions = (definition.meta?.editorPositions ?? {}) as Record<string, { x: number; y: number }>
    const stateEntries = Object.entries(definition.states)

    const nodes: EditorNode[] = stateEntries.map(([stateId, stateDef], idx) => ({
      id: stateId,
      type: inferNodeType(stateDef),
      position: positions[stateId] ?? { x: 100 + idx * 220, y: 100 + (idx % 2) * 120 },
      data: stateToData(stateDef)
    }))

    const startPosition = positions[START_NODE_ID] ?? {
      x: (positions[definition.initial]?.x ?? 200) - 180,
      y: positions[definition.initial]?.y ?? 100
    }
    nodes.unshift({
      id: START_NODE_ID,
      type: 'start',
      position: startPosition,
      data: { kind: 'start' }
    })

    const edges: EditorEdge[] = []
    if (definition.initial) {
      edges.push({
        id: `${START_NODE_ID}->${definition.initial}:start`,
        source: START_NODE_ID,
        target: definition.initial,
        label: 'start'
      })
    }

    for (const [sourceId, stateDef] of Object.entries(definition.states)) {
      for (const [event, targetDefRaw] of Object.entries(stateDef.on ?? {})) {
        const targetDefs = Array.isArray(targetDefRaw) ? targetDefRaw : [targetDefRaw]
        for (const targetDef of targetDefs) {
          edges.push({
            id: `${sourceId}->${targetDef.target}:${event}`,
            source: sourceId,
            target: targetDef.target,
            label: event
          })
        }
      }
    }

    return { nodes, edges }
  }

  function graphToDefinition(
    nodes: EditorNode[],
    edges: EditorEdge[],
    base: WorkflowDefinition = emptyDefinition('workflow')
  ): WorkflowDefinition {
    const stateNodes = nodes.filter(n => n.id !== START_NODE_ID)
    const states: WorkflowDefinition['states'] = {}
    const positions: Record<string, { x: number; y: number }> = {}

    for (const node of stateNodes) {
      states[node.id] = dataToState(node)
      positions[node.id] = node.position
    }
    const startEdge = edges.find(e => e.source === START_NODE_ID)
    const initial = startEdge?.target ?? base.initial

    for (const edge of edges) {
      if (edge.source === START_NODE_ID) continue
      const state = states[edge.source]
      if (!state) continue
      if (!state.on) state.on = {}
      state.on[edge.label] = { target: edge.target }
    }

    positions[START_NODE_ID] = nodes.find(n => n.id === START_NODE_ID)?.position ?? { x: 0, y: 0 }

    return {
      id: base.id,
      initial,
      states,
      context: base.context,
      meta: { ...base.meta, editorPositions: positions }
    }
  }

  return { definitionToGraph, graphToDefinition, START_NODE_ID }
}
