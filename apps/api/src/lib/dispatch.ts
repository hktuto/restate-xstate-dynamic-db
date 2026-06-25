import { listWorkflowDesigns, createWorkflowInstance } from 'db/tenant'
import { listPlatformWorkflowDesigns, createPlatformWorkflowInstance } from 'db/platform'
import type { WorkflowInstanceRecord } from 'db/tenant'
import type { PlatformWorkflowInstanceRecord } from 'db/platform'
import type { StartRule, WorkflowDefinition } from 'shared'
import { buildContextFromInputs } from './build-context.js'
import { resolveInputs } from 'workflow-actions/catalog/resolve-inputs'
import { notifyRuntimeCreate } from './notify-runtime.js'

export type DispatchMode = 'tenant' | 'platform'

export async function dispatchTrigger(
  namespace: string,
  tableName: string,
  crudEvent: string,
  record: Record<string, unknown>,
  options: { skip?: boolean; companyId?: string; database?: string } = {},
  mode: DispatchMode = 'tenant'
) {
  if (options.skip) return

  const recordId = record.id
  if (mode === 'platform' && (recordId === undefined || recordId === null || recordId === '')) {
    console.error('Cannot dispatch platform trigger: record has no id', { tableName, crudEvent, record })
    return
  }

  const effectiveNamespace = mode === 'platform' ? (record.namespace as string | undefined) : namespace
  if (mode === 'platform' && !effectiveNamespace) {
    console.error('Cannot dispatch platform trigger: record has no namespace', { tableName, crudEvent, record })
    return
  }

  const companyId = mode === 'platform' ? String(recordId) : options.companyId
  const database = mode === 'platform' ? 'admin' : (options.database ?? 'main')

  let designs
  try {
    designs = mode === 'platform' ? await listPlatformWorkflowDesigns() : await listWorkflowDesigns(namespace)
  } catch (err) {
    console.error(`Failed to list ${mode} workflow designs for trigger dispatch:`, err)
    return
  }

  const dispatches: Promise<void>[] = []

  for (const design of designs) {
    const rules = design.starts?.filter(
      (s) => s.type === 'db_trigger' && s.options.tableName === tableName && s.options.event === crudEvent
    ) ?? []

    for (const rule of rules) {
      try {
        const inputs = await resolveInputs(effectiveNamespace!, design.xstateConfig, rule.startState, database)
        const context = buildContextFromInputs(inputs, record)
        const instance = mode === 'platform'
          ? await createPlatformWorkflowInstance({
              designId: design.id,
              namespace: effectiveNamespace,
              companyId,
              triggerBy: { type: 'db_trigger', startState: rule.startState },
              context,
              status: 'pending'
            })
          : await createWorkflowInstance(namespace, {
              designId: design.id,
              namespace,
              companyId,
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
            companyId,
            namespace: mode === 'platform' ? effectiveNamespace! : namespace
          }).catch((err) => { console.error(`${mode} runtime create error:`, err) })
        )
      } catch (err) {
        console.error(`${mode} trigger rule dispatch failed:`, err)
        continue
      }
    }
  }

  await Promise.all(dispatches)
}

interface UserTriggerDesign {
  id: string
  xstateConfig: WorkflowDefinition
  starts?: StartRule[]
}

export async function dispatchUserTrigger(
  namespace: string,
  design: UserTriggerDesign,
  rule: StartRule,
  values: Record<string, unknown>,
  userId: string,
  database = 'main',
  mode: DispatchMode = 'tenant'
): Promise<WorkflowInstanceRecord | PlatformWorkflowInstanceRecord> {
  const inputs = await resolveInputs(namespace, design.xstateConfig, rule.startState, database)
  const context = buildContextFromInputs(inputs, values)
  const trigger = { type: 'user_trigger', startState: rule.startState } as const

  if (mode === 'platform') {
    const instance = await createPlatformWorkflowInstance({
      designId: design.id,
      namespace,
      triggerBy: trigger,
      context,
      status: 'pending'
    })
    await notifyRuntimeCreate(instance.id, {
      designId: design.id,
      trigger,
      context,
      createdBy: userId,
      namespace
    })
    return instance
  }

  const instance = await createWorkflowInstance(namespace, {
    designId: design.id,
    namespace,
    triggerBy: trigger,
    context,
    status: 'pending'
  })
  await notifyRuntimeCreate(instance.id, {
    designId: design.id,
    trigger,
    context,
    createdBy: userId,
    namespace
  })
  return instance
}
