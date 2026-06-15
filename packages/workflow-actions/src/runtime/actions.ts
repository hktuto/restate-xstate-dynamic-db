import type { ActionExecutor, RuntimeAction } from '../types.js'

const NITRO_API_URL = process.env.NITRO_API_URL || 'http://localhost:3000'

const log: ActionExecutor = ({ event }) => {
  console.log('[workflow log]', event)
}

const setStatusActive: ActionExecutor = async ({ record, namespace }) => {
  const userId = record?.id
  if (typeof userId !== 'number' && typeof userId !== 'string') return

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-restate-skip-trigger': 'true'
  }
  if (namespace) headers['x-company-namespace'] = namespace

  const res = await fetch(`${NITRO_API_URL}/api/users/${userId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'active' })
  })
  if (!res.ok) {
    throw new Error(`Failed to update user status: ${res.status}`)
  }
}

const sendWebhook: ActionExecutor = async ({ event, record, namespace, params }) => {
  const webhookUrl = (params?.url as string) || process.env.WEBHOOK_URL || `${NITRO_API_URL}/api/webhook`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (namespace) headers['x-company-namespace'] = namespace

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId: record?.id, email: record?.email, event: event?.type })
  })
  if (!res.ok) {
    throw new Error(`Webhook call failed: ${res.status}`)
  }
}

const provisionCompanyNamespace: ActionExecutor = async ({ record }) => {
  const namespace = record?.namespace
  if (typeof namespace !== 'string') {
    throw new Error('Missing company namespace in workflow event')
  }
  const { provisionCompanyNamespace } = await import('db/provision')
  await provisionCompanyNamespace(namespace)
}

export const runtimeActions: Record<string, RuntimeAction> = {
  log: {
    meta: { id: 'log', label: 'Log event', category: 'Debug' },
    execute: log
  },
  setStatusActive: {
    meta: { id: 'setStatusActive', label: 'Set status active', category: 'Record' },
    execute: setStatusActive
  },
  sendWebhook: {
    meta: {
      id: 'sendWebhook',
      label: 'Send webhook',
      category: 'Integrations',
      paramsSchema: {
        url: { type: 'string', label: 'Webhook URL', required: false }
      }
    },
    execute: sendWebhook
  },
  provisionCompanyNamespace: {
    meta: { id: 'provisionCompanyNamespace', label: 'Provision company namespace', category: 'Platform' },
    execute: provisionCompanyNamespace
  }
}
