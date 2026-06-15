import { listTriggers, getWorkflow } from 'db/tenant'

export default defineEventHandler(async (event) => {
  const triggers = await listTriggers(event.context.company.namespace)
  return await Promise.all(
    triggers.map(async (t) => {
      const workflow = await getWorkflow(event.context.company.namespace, t.workflowId)
      return { ...t, workflowName: workflow?.name ?? 'Unknown' }
    })
  )
})
