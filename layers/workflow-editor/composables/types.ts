export type EditorNodeType = 'start' | 'action' | 'condition' | 'task' | 'final'

export const CONDITION_ACTION_ID = 'condition'

export interface EditorNode {
  id: string
  type: EditorNodeType
  position: { x: number; y: number }
  data: EditorNodeData
}

export type EditorNodeData =
  | { kind: 'start' }
  | {
      kind: 'action'
      actionId: string
      params: Record<string, unknown>
      outputKey: string
    }
  | {
      kind: 'condition'
      expression: unknown
    }
  | {
      kind: 'task'
      taskType: 'approval' | 'review' | 'manual'
      taskInstructions: string
    }
  | { kind: 'final' }

export interface EditorEdge {
  id: string
  source: string
  target: string
  label: string
}
