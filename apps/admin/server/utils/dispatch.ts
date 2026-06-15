import type { H3Event } from 'h3'
import { listPlatformTriggers, getPlatformWorkflow, findActivePlatformWorkflowInstance, createPlatformWorkflowInstance } from 'db/platform'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'

export async function dispatchTrigger(event: H3Event, tableName: string, crudEvent: string, record: Record<string, unknown>) {
  try {
    if (getHeader(event, 'x-restate-skip-trigger')) {
      return
    }

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

    const triggers = await listPlatformTriggers()
    const matching = triggers.filter(t => t.tableName === tableName && t.event === crudEvent)
    if (!matching.length) return

    const dispatches: Promise<void>[] = []

    for (const trigger of matching) {
      const workflow = await getPlatformWorkflow(trigger.workflowId)
      if (!workflow) {
        console.error(`Workflow ${trigger.workflowId} not found for trigger ${trigger.id}`)
        continue
      }

      let instance = await findActivePlatformWorkflowInstance(trigger.workflowId, tableName, String(recordId))
      let instanceId: string
      let handler: 'create' | 'send' = 'create'

      if (instance) {
        instanceId = instance.id
        handler = 'send'
      } else {
        instance = await createPlatformWorkflowInstance({
          workflowId: trigger.workflowId,
          tableName,
          recordId: String(recordId),
          namespace,
          companyId
        })
        instanceId = instance.id
      }

      const payload = handler === 'create'
        ? {
            config: workflow.xstateConfig,
            event: crudEvent,
            tableName,
            record,
            workflowId: trigger.workflowId,
            companyId,
            namespace
          }
        : { event: crudEvent, record }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      dispatches.push(
        fetch(`${RESTATE_INGRESS}/workflow/${encodeURIComponent(instanceId)}/${handler}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        })
          .then(async res => {
            clearTimeout(timeout)
            if (!res.ok) {
              console.error(`Restate trigger dispatch failed: ${res.status} ${await res.text()}`)
            }
          })
          .catch(err => {
            clearTimeout(timeout)
            console.error('Restate trigger dispatch error:', err)
          })
      )
    }

    await Promise.all(dispatches)
  } catch (err) {
    console.error('Platform trigger dispatch failed:', err)
  }
}
