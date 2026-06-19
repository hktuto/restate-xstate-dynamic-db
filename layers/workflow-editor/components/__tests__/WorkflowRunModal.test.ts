import { describe, it, expect } from 'vitest'
import { buildPayload } from '../workflow-run-modal-helpers.js'
import type { ActionInputMetadata } from 'shared'

function input(overrides: Partial<ActionInputMetadata> & Pick<ActionInputMetadata, 'name' | 'label' | 'displayType'>): ActionInputMetadata {
  return {
    dbType: 'string',
    required: false,
    ...overrides
  } as ActionInputMetadata
}

describe('WorkflowRunModal buildPayload', () => {
  it('returns an error when a required string field is empty', () => {
    const inputs = [input({ name: 'email', label: 'Email', displayType: 'email', required: true })]
    const { values, errors } = buildPayload(inputs, { email: '' })
    expect(errors).toEqual(['Email is required'])
    expect(Object.keys(values)).toEqual([])
  })

  it('returns an error when a required checkbox is unchecked', () => {
    const inputs = [input({ name: 'agree', label: 'Agree', displayType: 'checkbox', required: true, dbType: 'boolean' })]
    const { values, errors } = buildPayload(inputs, { agree: false })
    expect(errors).toEqual(['Agree is required'])
    expect(Object.keys(values)).toEqual([])
  })

  it('returns an error for invalid JSON', () => {
    const inputs = [input({ name: 'payload', label: 'Payload', displayType: 'json', dbType: 'object' })]
    const { values, errors } = buildPayload(inputs, { payload: '{not json' })
    expect(errors).toEqual(['Payload must be valid JSON'])
    expect(Object.keys(values)).toEqual([])
  })

  it('parses valid JSON into an object in the payload', () => {
    const inputs = [input({ name: 'payload', label: 'Payload', displayType: 'json', dbType: 'object' })]
    const { values, errors } = buildPayload(inputs, { payload: '{"ok":true}' })
    expect(errors).toEqual([])
    expect(values.payload).toEqual({ ok: true })
  })

  it('coerces a number input into a number', () => {
    const inputs = [input({ name: 'count', label: 'Count', displayType: 'number', dbType: 'number' })]
    const { values, errors } = buildPayload(inputs, { count: '42' })
    expect(errors).toEqual([])
    expect(values.count).toBe(42)
    expect(typeof values.count).toBe('number')
  })

  it('returns an error for an invalid number input', () => {
    const inputs = [input({ name: 'count', label: 'Count', displayType: 'number', dbType: 'number' })]
    const { values, errors } = buildPayload(inputs, { count: 'abc' })
    expect(errors).toEqual(['Count must be a valid number'])
    expect(Object.keys(values)).toEqual([])
  })

  it('returns undefined for optional empty number and JSON fields', () => {
    const inputs = [
      input({ name: 'count', label: 'Count', displayType: 'number', dbType: 'number' }),
      input({ name: 'payload', label: 'Payload', displayType: 'json', dbType: 'object' })
    ]
    const { values, errors } = buildPayload(inputs, { count: '', payload: '' })
    expect(errors).toEqual([])
    expect(values.count).toBeUndefined()
    expect(values.payload).toBeUndefined()
  })

  it('keeps checkbox values as booleans', () => {
    const inputs = [input({ name: 'agree', label: 'Agree', displayType: 'checkbox', dbType: 'boolean' })]
    const { values, errors } = buildPayload(inputs, { agree: true })
    expect(errors).toEqual([])
    expect(values.agree).toBe(true)
  })

  it('keeps text values as strings', () => {
    const inputs = [input({ name: 'name', label: 'Name', displayType: 'text' })]
    const { values, errors } = buildPayload(inputs, { name: 'Alice' })
    expect(errors).toEqual([])
    expect(values.name).toBe('Alice')
  })
})
