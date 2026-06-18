import type { EditorNode } from './types.js'

const CONDITION_ACTION_ID = 'condition'
const TASK_SUGGESTED_EVENTS = ['approved', 'rejected']

export function useWorkflowRuntimeEvents() {
  function getResultEvents(node: EditorNode): string[] {
    if (node.type === 'start' || node.data.kind === 'start') return ['start']
    if (node.type === 'final' || node.data.kind === 'final') return []
    if (node.data.kind === 'action') {
      return node.data.actionId === CONDITION_ACTION_ID ? ['true', 'false'] : ['ok', 'error']
    }
    if (node.data.kind === 'condition') return ['true', 'false']
    if (node.data.kind === 'task') return TASK_SUGGESTED_EVENTS
    return []
  }

  function isEventAllowed(node: EditorNode, event: string): boolean {
    if (node.type === 'task' || node.data.kind === 'task') return event.length > 0
    return getResultEvents(node).includes(event)
  }

  function defaultEvent(node: EditorNode, usedEvents: string[]): string | null {
    const candidates = getResultEvents(node)
    const unused = candidates.filter(e => !usedEvents.includes(e))
    return unused[0] ?? candidates[0] ?? null
  }

  return { getResultEvents, isEventAllowed, defaultEvent }
}
