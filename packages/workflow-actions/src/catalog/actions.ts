import type { ActionMetadata } from 'shared'

export const actionsMetadata: ActionMetadata[] = [
  {
    id: 'log',
    label: 'Log event',
    description: 'Prints the workflow event to the runtime logs.',
    category: 'Debug'
  },
  {
    id: 'setStatusActive',
    label: 'Set status active',
    description: 'PATCHes the record status to active via the tenant API.',
    category: 'Record'
  },
  {
    id: 'sendWebhook',
    label: 'Send webhook',
    description: 'POSTs a JSON payload to a webhook URL.',
    category: 'Integrations',
    paramsSchema: {
      url: {
        type: 'string',
        label: 'Webhook URL',
        description: 'Override the default webhook URL. Falls back to the tenant API webhook endpoint if empty.',
        required: false
      }
    }
  },
  {
    id: 'provisionCompanyNamespace',
    label: 'Provision company namespace',
    description: 'Creates the SurrealDB namespace and seed tables for a new company.',
    category: 'Platform'
  }
]
