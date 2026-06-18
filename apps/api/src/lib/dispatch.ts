import { listTriggers, getWorkflow, findActiveWorkflowInstance, createWorkflowInstance } from 'db/tenant'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'

export interface DispatchOptions {
  skip?: boolean
  companyId?: string
}

export async function dispatchTrigger(
  namespace: string,
  tableName: string,
  crudEvent: string,
  record: Record<string, unknown>,
  options: DispatchOptions = {}
) {
  try {
    if (options.skip) {
      return
    }

    const recordId = record.id
    if (recordId === undefined || recordId === null || recordId === '') {
      console.error('Cannot dispatch trigger: record has no id', { tableName, crudEvent, record })
      return
    }

    const companyId = options.companyId

    const triggers = await listTriggers(namespace)
    const matching = triggers.filter((t) => t.tableName === tableName && t.event === crudEvent)
    if (!matching.length) return

    const dispatches: Promise<void>[] = []

    for (const trigger of matching) {
      const workflow = await getWorkflow(namespace, trigger.workflowId)
      if (!workflow) {
        console.error(`Workflow ${trigger.workflowId} not found for trigger ${trigger.id}`)
        continue
      }

      let instance = await findActiveWorkflowInstance(namespace, trigger.workflowId, tableName, String(recordId))
      let instanceId: string
      let handler: 'create' | 'send' = 'create'

      if (instance) {
        instanceId = instance.id
        handler = 'send'
      } else {
        instance = await createWorkflowInstance(namespace, {
          workflowId: trigger.workflowId,
          tableName,
          recordId: String(recordId),
          namespace,
          companyId,
        })
        instanceId = instance.id
      }

      const payload =
        handler === 'create'
          ? {
              config: workflow.xstateConfig,
              event: crudEvent,
              tableName,
              record,
              workflowId: trigger.workflowId,
              companyId,
              namespace,
            }
          : { event: crudEvent, record }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      dispatches.push(
        fetch(`${RESTATE_INGRESS}/workflow/${encodeURIComponent(instanceId)}/${handler}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
          .then(async (res) => {
            clearTimeout(timeout)
            if (!res.ok) {
              console.error(`Restate trigger dispatch failed: ${res.status} ${await res.text()}`)
            }
          })
          .catch((err) => {
            clearTimeout(timeout)
            console.error('Restate trigger dispatch error:', err)
          })
      )
    }

    await Promise.all(dispatches)
  } catch (err) {
    console.error('Trigger dispatch failed:', err)
  }
}
