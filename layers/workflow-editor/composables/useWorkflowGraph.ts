import type { WorkflowDefinition, WorkflowState, WorkflowTransition } from 'shared'

export interface EditorNode {
  id: string
  type: 'state'
  position: { x: number; y: number }
  data: {
    label: string
    entry: (string | { id: string; params?: Record<string, unknown> })[]
    exit: (string | { id: string; params?: Record<string, unknown> })[]
  }
}

export interface EditorEdge {
  id: string
  source: string
  target: string
  label: string
  animated?: boolean
  data?: {
    guard?: { type: string; params?: Record<string, unknown> }
    actions?: (string | { id: string; params?: Record<string, unknown> })[]
  }
}

function getPositions(definition: WorkflowDefinition): Record<string, { x: number; y: number }> {
  const meta = definition.meta ?? {}
  const positions = (meta.editorPositions ?? {}) as Record<string, { x: number; y: number }>
  return positions
}

export function useWorkflowGraph() {
  function definitionToGraph(definition: WorkflowDefinition): { nodes: EditorNode[]; edges: EditorEdge[] } {
    const positions = getPositions(definition)
    const stateEntries = Object.entries(definition.states)
    const nodes: EditorNode[] = stateEntries.map(([stateId, stateDef], idx) => {
      const persisted = positions[stateId]
      return {
        id: stateId,
        type: 'state',
        position: persisted ?? { x: 100 + idx * 220, y: 100 + (idx % 2) * 120 },
        data: {
          label: stateId,
          entry: normalizeActions(stateDef.entry),
          exit: normalizeActions(stateDef.exit)
        }
      }
    })

    const edges: EditorEdge[] = []
    for (const [sourceId, stateDef] of stateEntries) {
      for (const [event, targetDefRaw] of Object.entries(stateDef.on || {})) {
        const targetDefs = Array.isArray(targetDefRaw) ? targetDefRaw : [targetDefRaw]
        for (const targetDef of targetDefs) {
          const guardKey = targetDef.guard
            ? `${targetDef.guard.type}-${JSON.stringify(targetDef.guard.params ?? {})}`
            : 'no-guard'
          const actionKey = targetDef.actions?.length
            ? `-${JSON.stringify(targetDef.actions)}`
            : ''
          const id = `${sourceId}-${event}-${targetDef.target}-${guardKey}${actionKey}`
          edges.push({
            id,
            source: sourceId,
            target: targetDef.target,
            label: event,
            animated: true,
            data: {
              guard: targetDef.guard,
              actions: targetDef.actions
            }
          })
        }
      }
    }

    return { nodes, edges }
  }

  function graphToDefinition(
    nodes: EditorNode[],
    edges: EditorEdge[],
    initial: string,
    id: string,
    context?: Record<string, unknown>,
    existingMeta?: Record<string, unknown>,
    originalStates?: Record<string, WorkflowState>
  ): WorkflowDefinition {
    const states: WorkflowDefinition['states'] = {}

    const positions: Record<string, { x: number; y: number }> = {}
    for (const node of nodes) {
      positions[node.id] = node.position
      const original = originalStates?.[node.id] ?? {}
      states[node.id] = { ...original }
      if (node.data.entry.length) {
        states[node.id].entry = node.data.entry
      }
      if (node.data.exit.length) {
        states[node.id].exit = node.data.exit
      }
    }

    const grouped = new Map<string, EditorEdge[]>()
    for (const edge of edges) {
      const key = `${edge.source}::${edge.label}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(edge)
    }

    for (const [key, groupEdges] of grouped) {
      const [sourceId, event] = key.split('::')
      if (!states[sourceId].on) states[sourceId].on = {}

      const transitions: WorkflowTransition[] = groupEdges.map(edge => {
        const t: WorkflowTransition = { target: edge.target }
        if (edge.data?.guard) {
          t.guard = edge.data.guard
        }
        if (edge.data?.actions?.length) {
          t.actions = edge.data.actions
        }
        return t
      })

      states[sourceId].on![event] = transitions.length === 1 ? transitions[0] : transitions
    }

    return {
      id,
      initial,
      states,
      context,
      meta: { ...existingMeta, editorPositions: positions }
    }
  }

  function normalizeActions(entry?: WorkflowState['entry']): (string | { id: string; params?: Record<string, unknown> })[] {
    if (!entry) return []
    return entry.map(a => typeof a === 'string' ? a : { id: a.id, params: a.params })
  }

  return { definitionToGraph, graphToDefinition }
}
