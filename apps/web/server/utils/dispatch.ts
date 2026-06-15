import type { H3Event } from 'h3'
import { listTriggers, getWorkflow } from 'db/tenant'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'

export async function dispatchTrigger(event: H3Event, tableName: string, crudEvent: string, record: Record<string, unknown>) {
  if (getHeader(event, 'x-restate-skip-trigger')) {
    return
  }

  const namespace = event.context.company?.namespace
  if (!namespace) {
    console.error('No company namespace in context for trigger dispatch')
    return
  }

  const companyId = event.context.company?.id

  const triggers = await listTriggers(namespace)
  const matching = triggers.filter(t => t.tableName === tableName && t.event === crudEvent)
  if (!matching.length) return

  for (const trigger of matching) {
    const workflow = await getWorkflow(namespace, trigger.workflowId)
    if (!workflow) {
      console.error(`Workflow ${trigger.workflowId} not found for trigger ${trigger.id}`)
      continue
    }

    const payload = {
      config: workflow.xstateConfig,
      event: crudEvent,
      tableName,
      record,
      workflowId: trigger.workflowId,
      companyId,
      namespace
    }

    fetch(`${RESTATE_INGRESS}/workflow/executeWorkflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': `${tableName}:${crudEvent}:${record.id}:${trigger.workflowId}`
      },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        if (!res.ok) {
          console.error(`Restate trigger dispatch failed: ${res.status} ${await res.text()}`)
        }
      })
      .catch(err => {
        console.error('Restate trigger dispatch error:', err)
      })
  }
}
