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
    expect(values.email).toBeUndefined()
  })

  it('returns an error when a required checkbox is unchecked', () => {
    const inputs = [input({ name: 'agree', label: 'Agree', displayType: 'checkbox', required: true, dbType: 'boolean' })]
    const { values, errors } = buildPayload(inputs, { agree: false })
    expect(errors).toEqual(['Agree is required'])
    expect(values.agree).toBeUndefined()
  })

  it('returns an error for invalid JSON', () => {
    const inputs = [input({ name: 'payload', label: 'Payload', displayType: 'json', dbType: 'object' })]
    const { values, errors } = buildPayload(inputs, { payload: '{not json' })
    expect(errors).toEqual(['Payload must be valid JSON'])
    expect(values.payload).toBeUndefined()
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
    expect(values.count).toBeUndefined()
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

  it('builds nested object values', () => {
    const inputs = [
      input({
        name: 'address',
        label: 'Address',
        displayType: 'json',
        dbType: 'object',
        fields: [
          input({ name: 'street', label: 'Street', displayType: 'text', dbType: 'string' }),
          input({ name: 'city', label: 'City', displayType: 'text', dbType: 'string' }),
        ],
      }),
    ]
    const { values, errors } = buildPayload(inputs, {
      address: { street: '123 Main', city: 'NYC' },
    })
    expect(errors).toEqual([])
    expect(values).toEqual({ address: { street: '123 Main', city: 'NYC' } })
  })

  it('reports missing required nested fields', () => {
    const inputs = [
      input({
        name: 'address',
        label: 'Address',
        displayType: 'json',
        dbType: 'object',
        fields: [
          input({ name: 'street', label: 'Street', displayType: 'text', dbType: 'string', required: true }),
        ],
      }),
    ]
    const { values, errors } = buildPayload(inputs, { address: { street: '' } })
    expect(errors).toEqual(['Street is required'])
    expect(values.address).toEqual({ street: undefined })
  })

  it('builds array-of-object values', () => {
    const inputs = [
      input({
        name: 'invoiceLines',
        label: 'Invoice Lines',
        displayType: 'json',
        dbType: 'array',
        fields: [
          input({ name: 'id', label: 'ID', displayType: 'text', dbType: 'string' }),
          input({ name: 'date', label: 'Date', displayType: 'date', dbType: 'datetime' }),
          input({ name: 'item', label: 'Item', displayType: 'text', dbType: 'string' }),
          input({ name: 'total', label: 'Total', displayType: 'number', dbType: 'number' }),
        ],
      }),
    ]
    const { values, errors } = buildPayload(inputs, {
      invoiceLines: [
        { id: 'a', date: '2026-06-19', item: 'Widget', total: '10' },
        { id: 'b', date: '2026-06-20', item: 'Gadget', total: '20' },
      ],
    })
    expect(errors).toEqual([])
    expect(values).toEqual({
      invoiceLines: [
        { id: 'a', date: '2026-06-19', item: 'Widget', total: 10 },
        { id: 'b', date: '2026-06-20', item: 'Gadget', total: 20 },
      ],
    })
  })

  it('reports a malformed object value', () => {
    const inputs = [
      input({
        name: 'address',
        label: 'Address',
        displayType: 'json',
        dbType: 'object',
        fields: [
          input({ name: 'street', label: 'Street', displayType: 'text', dbType: 'string' }),
        ],
      }),
    ]
    const { values, errors } = buildPayload(inputs, { address: 'not-an-object' })
    expect(errors).toEqual(['Address must be an object'])
    expect(values.address).toBeUndefined()
  })

  it('reports a malformed array value', () => {
    const inputs = [
      input({
        name: 'invoiceLines',
        label: 'Invoice Lines',
        displayType: 'json',
        dbType: 'array',
        fields: [
          input({ name: 'id', label: 'ID', displayType: 'text', dbType: 'string' }),
        ],
      }),
    ]
    const { values, errors } = buildPayload(inputs, { invoiceLines: 'not-an-array' })
    expect(errors).toEqual(['Invoice Lines must be an array'])
    expect(values.invoiceLines).toBeUndefined()
  })

  it('reports malformed array items', () => {
    const inputs = [
      input({
        name: 'invoiceLines',
        label: 'Invoice Lines',
        displayType: 'json',
        dbType: 'array',
        fields: [
          input({ name: 'id', label: 'ID', displayType: 'text', dbType: 'string' }),
        ],
      }),
    ]
    const { values, errors } = buildPayload(inputs, { invoiceLines: ['not-an-object'] })
    expect(errors).toEqual(['Invoice Lines item must be an object'])
    expect(values.invoiceLines).toEqual([undefined])
  })
})
