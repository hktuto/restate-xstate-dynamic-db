import type { WorkflowDesignRecord, WorkflowInstanceRecord } from 'db/tenant'
import type { PlatformWorkflowDesignRecord, PlatformWorkflowInstanceRecord } from 'db/platform'
import type { StartRule } from 'shared'
import { createWorkflowInstance } from 'db/tenant'
import { createPlatformWorkflowInstance } from 'db/platform'
import { buildContextFromInputs } from './build-context.js'
import { resolveInputs } from 'workflow-actions/catalog/resolve-inputs'
import { notifyRuntimeCreate } from './notify-runtime.js'

export async function dispatchUserTrigger(
  namespace: string,
  design: WorkflowDesignRecord,
  rule: StartRule,
  values: Record<string, unknown>,
  userId: string,
  database = 'main'
): Promise<WorkflowInstanceRecord> {
  const inputs = await resolveInputs(namespace, design.xstateConfig, rule.startState, database)
  const context = buildContextFromInputs(inputs, values)
  const instance = await createWorkflowInstance(namespace, {
    designId: design.id,
    namespace,
    triggerBy: { type: 'user_trigger', startState: rule.startState },
    context,
    status: 'pending'
  })
  await notifyRuntimeCreate(instance.id, {
    designId: design.id,
    trigger: { type: 'user_trigger', startState: rule.startState },
    context,
    createdBy: userId,
    namespace
  })
  return instance
}

export async function dispatchPlatformUserTrigger(
  namespace: string,
  design: PlatformWorkflowDesignRecord,
  rule: StartRule,
  values: Record<string, unknown>,
  userId: string,
  database = 'admin'
): Promise<PlatformWorkflowInstanceRecord> {
  const inputs = await resolveInputs(namespace, design.xstateConfig, rule.startState, database)
  const context = buildContextFromInputs(inputs, values)
  const instance = await createPlatformWorkflowInstance({
    designId: design.id,
    namespace,
    triggerBy: { type: 'user_trigger', startState: rule.startState },
    context,
    status: 'pending'
  })
  await notifyRuntimeCreate(instance.id, {
    designId: design.id,
    trigger: { type: 'user_trigger', startState: rule.startState },
    context,
    createdBy: userId,
    namespace
  })
  return instance
}
