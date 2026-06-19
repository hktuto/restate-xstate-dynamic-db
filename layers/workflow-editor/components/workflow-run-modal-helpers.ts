import type { ActionInputMetadata } from 'shared'

export function buildPayload(
  inputs: ActionInputMetadata[],
  formValues: Record<string, string | boolean>
): { values: Record<string, unknown>; errors: string[] } {
  const values: Record<string, unknown> = {}
  const errors: string[] = []

  for (const input of inputs) {
    const raw = formValues[input.name]
    const value = raw === undefined || raw === null ? '' : raw

    if (input.required) {
      if (input.displayType === 'checkbox') {
        if (!value) {
          errors.push(`${input.label} is required`)
          continue
        }
      } else if (typeof value !== 'string' || value.trim() === '') {
        errors.push(`${input.label} is required`)
        continue
      }
    }

    if (input.displayType === 'json') {
      const str = typeof value === 'string' ? value : ''
      if (str.trim() === '') {
        values[input.name] = undefined
      } else {
        try {
          values[input.name] = JSON.parse(str)
        } catch {
          errors.push(`${input.label} must be valid JSON`)
        }
      }
    } else if (input.displayType === 'number') {
      const str = typeof value === 'string' ? value : ''
      if (str.trim() === '') {
        values[input.name] = undefined
      } else {
        const num = Number(str)
        if (Number.isNaN(num)) {
          errors.push(`${input.label} must be a valid number`)
        } else {
          values[input.name] = num
        }
      }
    } else if (input.displayType === 'checkbox') {
      values[input.name] = Boolean(value)
    } else {
      values[input.name] = typeof value === 'string' ? value : String(value)
    }
  }

  return { values, errors }
}
