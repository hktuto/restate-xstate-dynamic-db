import type { WorkflowDefinition, ActionInputMetadata } from 'shared'
import { resolveInputs } from 'workflow-actions/catalog/resolve-inputs'

export async function useWorkflowRun(namespace: string, definition: WorkflowDefinition, startState: string) {
  const inputs = await resolveInputs(namespace, definition, startState)
  const visibleInputs = computed(() => inputs.filter((i) => !i.hidden))
  return { inputs, visibleInputs }
}
