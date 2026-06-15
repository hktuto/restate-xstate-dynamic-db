import type { WorkflowDefinition, WorkflowState, WorkflowTransition } from 'shared'

export interface EditorNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: { label: string; actions: (string | { id: string; params?: Record<string, unknown> })[] }
}

export interface EditorEdge {
  id: string
  source: string
  target: string
  label: string
  animated?: boolean
  data?: { guardType?: string; guardParams?: Record<string, unknown> }
}

export function useWorkflowGraph() {
  function definitionToGraph(definition: WorkflowDefinition): { nodes: EditorNode[]; edges: EditorEdge[] } {
    const stateEntries = Object.entries(definition.states)
    const nodes: EditorNode[] = stateEntries.map(([stateId, stateDef], idx) => ({
      id: stateId,
      position: { x: 100 + idx * 220, y: 100 + (idx % 2) * 120 },
      data: { label: stateId, actions: normalizeActions(stateDef.entry) }
    }))

    const edges: EditorEdge[] = []
    for (const [sourceId, stateDef] of stateEntries) {
      for (const [event, targetDefRaw] of Object.entries(stateDef.on || {})) {
        const targetDefs = Array.isArray(targetDefRaw) ? targetDefRaw : [targetDefRaw]
        for (const targetDef of targetDefs) {
          const guardKey = targetDef.guard
            ? `${targetDef.guard.type}-${JSON.stringify(targetDef.guard.params ?? {})}`
            : 'no-guard'
          edges.push({
            id: `${sourceId}-${event}-${targetDef.target}-${guardKey}`,
            source: sourceId,
            target: targetDef.target,
            label: event,
            animated: true,
            data: targetDef.guard
              ? { guardType: targetDef.guard.type, guardParams: targetDef.guard.params }
              : undefined
          })
        }
      }
    }

    return { nodes, edges }
  }

  function graphToDefinition(nodes: EditorNode[], edges: EditorEdge[], initial: string, id: string): WorkflowDefinition {
    const states: WorkflowDefinition['states'] = {}

    for (const node of nodes) {
      states[node.id] = {}
      if (node.data.actions.length) {
        states[node.id].entry = node.data.actions
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
        if (edge.data?.guardType) {
          t.guard = {
            type: edge.data.guardType,
            params: edge.data.guardParams
          }
        }
        return t
      })

      states[sourceId].on![event] = transitions.length === 1 ? transitions[0] : transitions
    }

    return { id, initial, states }
  }

  function normalizeActions(entry?: WorkflowState['entry']): (string | { id: string; params?: Record<string, unknown> })[] {
    if (!entry) return []
    return entry.map(a => typeof a === 'string' ? a : { id: a.id, params: a.params })
  }

  return { definitionToGraph, graphToDefinition }
}
