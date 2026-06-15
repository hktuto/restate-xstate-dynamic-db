import { listWorkflows } from 'db/tenant'

export default defineEventHandler(async (event) => {
  return listWorkflows(event.context.company.namespace)
})
