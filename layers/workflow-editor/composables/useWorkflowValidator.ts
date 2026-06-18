import type { EditorEdge, EditorNode } from './types.js'
import { useWorkflowRuntimeEvents } from './useWorkflowRuntimeEvents.js'

export interface ValidationError {
  id: string
  path: string
  message: string
}

const START_NODE_ID = '__start'
const JS_ID = /^[a-zA-Z_][a-zA-Z0-9_]*$/

function isEmptyExpression(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

export function useWorkflowValidator() {
  const { isEventAllowed } = useWorkflowRuntimeEvents()

  function validate(nodes: EditorNode[], edges: EditorEdge[]): ValidationError[] {
    const errors: ValidationError[] = []
    const nodeMap = new Map(nodes.map(n => [n.id, n]))

    const startNodes = nodes.filter(n => n.id === START_NODE_ID)
    if (startNodes.length !== 1) {
      errors.push({ id: START_NODE_ID, path: 'start', message: 'Exactly one Start node is required' })
    }

    const ids = new Set<string>()
    for (const node of nodes) {
      if (ids.has(node.id)) {
        errors.push({ id: node.id, path: `nodes.${node.id}`, message: `Duplicate state id "${node.id}"` })
      }
      ids.add(node.id)
      if (node.id !== START_NODE_ID && !JS_ID.test(node.id)) {
        errors.push({ id: node.id, path: `nodes.${node.id}`, message: `State id "${node.id}" must be a valid identifier` })
      }
    }

    const startEdges = edges.filter(e => e.source === START_NODE_ID)
    if (startEdges.length !== 1) {
      errors.push({ id: START_NODE_ID, path: 'start.edge', message: 'Start node must have exactly one outgoing transition' })
    } else if (!nodeMap.has(startEdges[0].target)) {
      errors.push({ id: startEdges[0].id, path: 'start.edge.target', message: 'Start transition points to a missing state' })
    }

    const hasFinal = nodes.some(n => n.type === 'final')
    if (!hasFinal) {
      errors.push({ id: 'final', path: 'final', message: 'At least one Final state is required' })
    }

    for (const node of nodes) {
      if (node.type === 'final') {
        if (edges.some(e => e.source === node.id)) {
          errors.push({ id: node.id, path: `nodes.${node.id}.on`, message: 'Final states cannot have outgoing transitions' })
        }
        continue
      }

      if (node.id === START_NODE_ID) continue

      const outgoing = edges.filter(e => e.source === node.id)
      if (!outgoing.length) {
        errors.push({ id: node.id, path: `nodes.${node.id}.on`, message: `State "${node.id}" must have at least one outgoing transition` })
      }

      if (node.type === 'action' && node.data.kind === 'action' && !node.data.actionId) {
        errors.push({ id: node.id, path: `nodes.${node.id}.action`, message: `Action state "${node.id}" must select an action` })
      }

      if (node.type === 'condition' && node.data.kind === 'condition') {
        if (isEmptyExpression(node.data.expression)) {
          errors.push({ id: node.id, path: `nodes.${node.id}.expression`, message: `Condition state "${node.id}" must have an expression` })
        }
      }

      if (node.type === 'task' && node.data.kind === 'task' && !node.data.taskType) {
        errors.push({ id: node.id, path: `nodes.${node.id}.taskType`, message: `Task state "${node.id}" must select a task type` })
      }
    }

    for (const edge of edges) {
      if (!nodeMap.has(edge.source)) {
        errors.push({ id: edge.id, path: `edges.${edge.id}.source`, message: `Transition sources missing state "${edge.source}"` })
      }
      if (!nodeMap.has(edge.target)) {
        errors.push({ id: edge.id, path: `edges.${edge.id}.target`, message: `Transition targets missing state "${edge.target}"` })
      }
      const source = nodeMap.get(edge.source)
      if (!source || source.id === START_NODE_ID) continue
      if (!isEventAllowed(source, edge.label)) {
        errors.push({ id: edge.id, path: `edges.${edge.id}.event`, message: `Event "${edge.label}" is not allowed from state "${edge.source}"` })
      }
    }

    return errors
  }

  return { validate }
}
