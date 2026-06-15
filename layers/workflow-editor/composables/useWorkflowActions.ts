import { actionsMetadata, guardsMetadata } from 'workflow-actions/meta'

export function useWorkflowActions() {
  return {
    actions: actionsMetadata,
    guards: guardsMetadata
  }
}
