import { listPlatformWorkflowDesigns, createPlatformWorkflowInstance } from 'db/platform'
import { buildContextFromInputs } from './build-context.js'
import { resolveInputs } from 'workflow-actions/catalog/resolve-inputs'
import { notifyRuntimeCreate } from './notify-runtime.js'

export interface DispatchPlatformTriggerOptions {
  skip?: boolean
}

export async function dispatchPlatformTrigger(
  tableName: string,
  crudEvent: string,
  record: Record<string, unknown>,
  options: DispatchPlatformTriggerOptions = {}
) {
  if (options.skip) return

  const recordId = record.id
  if (recordId === undefined || recordId === null || recordId === '') {
    console.error('Cannot dispatch platform trigger: record has no id', { tableName, crudEvent, record })
    return
  }

  const namespace = (record as { namespace?: string }).namespace
  if (!namespace) {
    console.error('Cannot dispatch platform trigger: record has no namespace', { tableName, crudEvent, record })
    return
  }

  // For platform workflows, the dispatched record is typically the company record,
  // so record.id doubles as the companyId.
  const companyId = String(recordId)

  let designs
  try {
    designs = await listPlatformWorkflowDesigns()
  } catch (err) {
    console.error('Failed to list platform workflow designs for trigger dispatch:', err)
    return
  }

  const dispatches: Promise<void>[] = []

  for (const design of designs) {
    const rules = design.starts?.filter(
      (s) => s.type === 'db_trigger' && s.options.tableName === tableName && s.options.event === crudEvent
    ) ?? []

    for (const rule of rules) {
      try {
        const inputs = await resolveInputs(namespace, design.xstateConfig, rule.startState, 'admin')
        const context = buildContextFromInputs(inputs, record)
        const instance = await createPlatformWorkflowInstance({
          designId: design.id,
          namespace,
          companyId,
          triggerBy: { type: 'db_trigger', startState: rule.startState },
          context,
          status: 'pending'
        })
        dispatches.push(notifyRuntimeCreate(instance.id, {
          designId: design.id,
          trigger: { type: 'db_trigger', startState: rule.startState },
          context,
          createdBy: 'system',
          companyId,
          namespace
        }).catch((err) => { console.error('Platform runtime create error:', err) }))
      } catch (err) {
        console.error('Platform trigger rule dispatch failed:', err)
        continue
      }
    }
  }

  await Promise.all(dispatches)
}
