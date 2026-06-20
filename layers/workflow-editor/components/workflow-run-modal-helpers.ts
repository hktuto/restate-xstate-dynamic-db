import type { ActionInputMetadata } from 'shared'

export function buildPayload(
  inputs: ActionInputMetadata[],
  formValues: Record<string, unknown>
): { values: Record<string, unknown>; errors: string[] } {
  const values: Record<string, unknown> = {}
  const errors: string[] = []

  for (const input of inputs) {
    const { value, errors: fieldErrors } = processField(input, formValues[input.name])
    errors.push(...fieldErrors)
    values[input.name] = value
  }

  return { values, errors }
}

function processField(
  input: ActionInputMetadata,
  raw: unknown
): { value: unknown; errors: string[] } {
  const errors: string[] = []

  if (input.fields && input.fields.length > 0) {
    if (input.dbType === 'object') {
      if (raw !== undefined && raw !== null && !isPlainObject(raw)) {
        errors.push(`${input.label} must be an object`)
        return { value: undefined, errors }
      }
      const obj = isPlainObject(raw) ? raw : {}
      const result: Record<string, unknown> = {}
      for (const field of input.fields) {
        const { value: childValue, errors: childErrors } = processField(field, obj[field.name])
        errors.push(...childErrors)
        result[field.name] = childValue
      }
      return { value: result, errors }
    }

    if (input.dbType === 'array') {
      if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
        errors.push(`${input.label} must be an array`)
        return { value: undefined, errors }
      }
      // Each array item is an object whose shape is defined by the array's fields.
      const itemSchema: ActionInputMetadata = {
        name: '',
        label: `${input.label} item`,
        dbType: 'object',
        displayType: 'json',
        fields: input.fields,
      }
      const arr = Array.isArray(raw) ? raw : []
      const result: unknown[] = []
      for (const item of arr) {
        const { value: itemValue, errors: itemErrors } = processField(itemSchema, item)
        errors.push(...itemErrors)
        result.push(itemValue)
      }
      return { value: result, errors }
    }
  }

  return processLeaf(input, raw, errors)
}

function processLeaf(
  input: ActionInputMetadata,
  raw: unknown,
  errors: string[]
): { value: unknown; errors: string[] } {
  if (input.required) {
    if (input.displayType === 'checkbox') {
      if (!raw) {
        errors.push(`${input.label} is required`)
        return { value: undefined, errors }
      }
    } else if (typeof raw !== 'string' || raw.trim() === '') {
      errors.push(`${input.label} is required`)
      return { value: undefined, errors }
    }
  }

  if (input.displayType === 'json' || input.displayType === 'richText') {
    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      return { value: undefined, errors }
    }
    if (typeof raw === 'string') {
      try {
        return { value: JSON.parse(raw), errors }
      } catch {
        errors.push(`${input.label} must be valid JSON`)
        return { value: undefined, errors }
      }
    }
    return { value: raw, errors }
  }

  if (input.displayType === 'number') {
    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      return { value: undefined, errors }
    }
    const num = Number(raw)
    if (Number.isNaN(num)) {
      errors.push(`${input.label} must be a valid number`)
      return { value: undefined, errors }
    }
    return { value: num, errors }
  }

  if (input.displayType === 'checkbox') {
    return { value: Boolean(raw), errors }
  }

  if (raw === undefined || raw === null) {
    return { value: '', errors }
  }
  return { value: String(raw), errors }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
