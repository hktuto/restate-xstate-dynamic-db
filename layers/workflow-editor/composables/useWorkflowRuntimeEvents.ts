import type { EditorNodeData, EditorNodeType } from './types.js'

const TASK_SUGGESTED_EVENTS = ['approved', 'rejected']

export function useWorkflowRuntimeEvents() {
  function getResultEvents(type: EditorNodeType, data: EditorNodeData): string[] {
    if (type === 'start' || data.kind === 'start') return ['start']
    if (type === 'final' || data.kind === 'final') return []
    if (data.kind === 'action') return data.actionId === 'condition' ? ['true', 'false'] : ['ok', 'error']
    if (data.kind === 'condition') return ['true', 'false']
    if (data.kind === 'task') return TASK_SUGGESTED_EVENTS
    return []
  }

  function isEventAllowed(type: EditorNodeType, data: EditorNodeData, event: string): boolean {
    if (type === 'task' || data.kind === 'task') return event.length > 0
    const allowed = getResultEvents(type, data)
    return allowed.includes(event)
  }

  function defaultEvent(type: EditorNodeType, data: EditorNodeData, used: string[]): string | null {
    const candidates = getResultEvents(type, data)
    const unused = candidates.filter(e => !used.includes(e))
    return unused[0] ?? candidates[0] ?? null
  }

  return { getResultEvents, isEventAllowed, defaultEvent }
}
