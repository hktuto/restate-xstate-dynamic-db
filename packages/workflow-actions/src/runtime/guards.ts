import type { GuardExecutor, RuntimeGuard } from '../types.js'

const emailContains: GuardExecutor = ({ event, params }) => {
  const email = event?.record?.email ?? event?.email
  return typeof email === 'string' && email.includes(String(params?.value ?? ''))
}

const emailNotContains: GuardExecutor = ({ event, params }) => {
  const email = event?.record?.email ?? event?.email
  return typeof email === 'string' && !email.includes(String(params?.value ?? ''))
}

const recordHasField: GuardExecutor = ({ event, params }) => {
  const field = String(params?.field ?? '')
  if (!field) return false
  const record = event?.record ?? event
  const value = record?.[field]
  return value !== undefined && value !== null && value !== ''
}

export const runtimeGuards: Record<string, RuntimeGuard> = {
  emailContains: {
    meta: { id: 'emailContains', label: 'Email contains', paramsSchema: { value: { type: 'string', label: 'Value', required: true } } },
    evaluate: emailContains
  },
  emailNotContains: {
    meta: { id: 'emailNotContains', label: 'Email does not contain', paramsSchema: { value: { type: 'string', label: 'Value', required: true } } },
    evaluate: emailNotContains
  },
  recordHasField: {
    meta: { id: 'recordHasField', label: 'Record has field', paramsSchema: { field: { type: 'string', label: 'Field name', required: true } } },
    evaluate: recordHasField
  }
}
