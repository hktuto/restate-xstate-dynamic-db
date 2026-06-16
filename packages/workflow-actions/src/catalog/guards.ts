import type { GuardMetadata } from 'shared'

export const guardsMetadata: GuardMetadata[] = [
  {
    id: 'condition',
    label: 'Condition expression',
    description: 'Allows the transition only when a MongoDB-style expression evaluates to true.',
    paramsSchema: {
      expression: { type: 'json', label: 'Expression', required: true }
    }
  }
]
