import { listWorkflowDesigns, createWorkflowInstance } from 'db/tenant'
import { buildContextFromInputs } from './build-context.js'
import { resolveInputs } from 'workflow-actions/catalog/resolve-inputs'

export interface DispatchTriggerOptions {
  skip?: boolean
  companyId?: string
  database?: string
}

export async function dispatchTrigger(
  namespace: string,
  tableName: string,
  crudEvent: string,
  record: Record<string, unknown>,
  options: DispatchTriggerOptions = {}
) {
  if (options.skip) return

  let designs
  try {
    designs = await listWorkflowDesigns(namespace)
  } catch (err) {
    console.error('Failed to list workflow designs for trigger dispatch:', err)
    return
  }

  const dispatches: Promise<void>[] = []

  for (const design of designs) {
    const rules = design.starts?.filter(
      (s) => s.type === 'db_trigger' && s.options.tableName === tableName && s.options.event === crudEvent
    ) ?? []

    for (const rule of rules) {
      try {
        const inputs = await resolveInputs(namespace, design.xstateConfig, rule.startState, options.database ?? 'main')
        const context = buildContextFromInputs(inputs, record)
        const instance = await createWorkflowInstance(namespace, {
          designId: design.id,
          namespace,
          companyId: options.companyId,
          triggerBy: { type: 'db_trigger', startState: rule.startState },
          context,
          status: 'pending'
        })
        dispatches.push(
          notifyRuntimeCreate(instance.id, {
            designId: design.id,
            trigger: { type: 'db_trigger', startState: rule.startState },
            context,
            createdBy: 'system',
            companyId: options.companyId,
            namespace
          })
        )
      } catch (err) {
        console.error('Trigger rule dispatch failed:', err)
        continue
      }
    }
  }

  await Promise.all(dispatches)
}

async function notifyRuntimeCreate(
  instanceId: string,
  payload: {
    designId: string
    trigger: { type: 'db_trigger'; startState: string }
    context: Record<string, unknown>
    createdBy: string
    companyId?: string
    namespace: string
  }
) {
  const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`${RESTATE_INGRESS}/workflow/${encodeURIComponent(instanceId)}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown')
      console.error(`Runtime create failed for instance ${instanceId}: ${res.status} ${text}`)
    }
  } catch (err) {
    console.error(`Runtime create error for instance ${instanceId}:`, err)
  } finally {
    clearTimeout(timeout)
  }
}
