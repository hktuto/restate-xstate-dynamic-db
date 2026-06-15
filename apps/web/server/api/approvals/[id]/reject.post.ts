import { getApprovalById, updateApprovalStatus } from 'db/tenant'

const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const namespace = event.context.company.namespace

  const approval = await getApprovalById(namespace, id)
  if (!approval) throw createError({ statusCode: 404, statusMessage: 'Approval not found' })

  const res = await fetch(`${RESTATE_INGRESS}/restate/awakeables/${approval.awakeableId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-company-namespace': namespace
    },
    body: JSON.stringify({ approved: false })
  })
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `Restate resolve failed: ${res.status}` })
  }

  await updateApprovalStatus(namespace, id, 'rejected')
  return { ok: true }
})
