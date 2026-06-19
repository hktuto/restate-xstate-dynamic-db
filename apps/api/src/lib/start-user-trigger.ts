import type { WorkflowDesignRecord, WorkflowInstanceRecord } from 'db/tenant'
import type { PlatformWorkflowDesignRecord, PlatformWorkflowInstanceRecord } from 'db/platform'
import type { StartRule } from 'shared'
import { createWorkflowInstance } from 'db/tenant'
import { createPlatformWorkflowInstance } from 'db/platform'
import { buildContextFromInputs } from './build-context.js'
import { resolveInputs } from 'workflow-actions/catalog/resolve-inputs'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'

async function notifyRuntimeCreate(
  instanceId: string,
  designId: string,
  trigger: { type: 'user_trigger'; startState: string },
  context: Record<string, unknown>,
  createdBy: string
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`${RESTATE_INGRESS}/workflow/${encodeURIComponent(instanceId)}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ designId, trigger, context, createdBy }),
      signal: controller.signal
    })
    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown')
      throw new Error(`Runtime create failed: ${res.status} ${text}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

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
  await notifyRuntimeCreate(instance.id, design.id, { type: 'user_trigger', startState: rule.startState }, context, userId)
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
  await notifyRuntimeCreate(instance.id, design.id, { type: 'user_trigger', startState: rule.startState }, context, userId)
  return instance
}
