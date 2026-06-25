import type { TriggerBy } from 'shared'

export async function notifyRuntimeCreate(
  instanceId: string,
  payload: {
    designId: string
    trigger: TriggerBy
    context: Record<string, unknown>
    createdBy: string
    companyId?: string
    namespace: string
  }
): Promise<void> {
  const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'
  const res = await fetch(`${RESTATE_INGRESS}/workflow/${encodeURIComponent(instanceId)}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  })
  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown')
    throw new Error(`Runtime create failed: ${res.status} ${text}`)
  }
}
