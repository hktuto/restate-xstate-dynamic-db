import type { TriggerBy } from 'shared'

export interface RuntimeCreatePayload {
  designId: string
  trigger: TriggerBy
  context: Record<string, unknown>
  createdBy: string
  companyId?: string
  namespace: string
}

export async function notifyRuntimeCreate(
  instanceId: string,
  payload: RuntimeCreatePayload
): Promise<void> {
  const RESTATE_INGRESS = process.env.RESTATE_INGRESS || 'http://localhost:8080'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`${RESTATE_INGRESS}/workflow/${encodeURIComponent(instanceId)}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown')
      throw new Error(`Runtime create failed: ${res.status} ${text}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}
