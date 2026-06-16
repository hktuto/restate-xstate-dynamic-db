import type { GuardExecutor, RuntimeGuard } from '../types.js'
import { evaluateExpression } from './expression.js'

const condition: GuardExecutor = ({ context, params }) => {
  return evaluateExpression(params?.expression, context ?? {})
}

export const runtimeGuards: Record<string, RuntimeGuard> = {
  condition: {
    meta: { id: 'condition', label: 'Condition expression', description: 'Evaluates a MongoDB-style expression' },
    evaluate: condition
  }
}
