import { getSurreal, closeSurreal } from 'db'
import type { H3Event } from 'h3'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'

export async function dispatchTrigger(event: H3Event, tableName: string, crudEvent: string, record: Record<string, unknown>) {
  if (getHeader(event, 'x-restate-skip-trigger')) {
    return
  }

  const surreal = await getSurreal('platform', 'admin')
  try {
    const [rows] = await surreal.query<[any[]]>(
      'SELECT * FROM triggers WHERE tableName = $tableName AND event = $event',
      { tableName, event: crudEvent }
    )
    if (!rows.length) return

    for (const trigger of rows) {
      const [workflows] = await surreal.query<[any[]]>(
        'SELECT * FROM workflows WHERE id = $id',
        { id: trigger.workflowId }
      )
      const workflow = workflows[0]
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
        companyId: record.id,
        namespace: (record as any).namespace
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
  } finally {
    await closeSurreal(surreal)
  }
}
