import { CONDITION_ACTION_ID, type EditorNode } from './types.js'

export const TASK_SUGGESTED_EVENTS = ['approved', 'rejected']

export function useWorkflowRuntimeEvents() {
  function getResultEvents(node: EditorNode): string[] {
    switch (node.data.kind) {
      case 'start': return ['start']
      case 'final': return []
      case 'action':
        return node.data.actionId === CONDITION_ACTION_ID ? ['true', 'false'] : ['ok', 'error']
      case 'condition': return ['true', 'false']
      case 'task': return TASK_SUGGESTED_EVENTS
      default: return []
    }
  }

  function isEventAllowed(node: EditorNode, event: string): boolean {
    if (node.data.kind === 'task') return event.trim().length > 0
    return getResultEvents(node).includes(event)
  }

  function defaultEvent(node: EditorNode, usedEvents: string[]): string | null {
    const candidates = getResultEvents(node)
    const unused = candidates.filter(e => !usedEvents.includes(e))
    return unused[0] ?? candidates[0] ?? null
  }

  return { getResultEvents, isEventAllowed, defaultEvent }
}
