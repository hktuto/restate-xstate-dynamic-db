import { describe, it, expect } from 'vitest'
import { buildContextFromInputs } from './build-context.js'

describe('buildContextFromInputs', () => {
  it('maps record fields by input name', () => {
    const source = { id: 'r:1', name: 'Acme', description: 'A company' }
    const inputs = [
      { name: 'id', label: 'ID', dbType: 'record' as const, displayType: 'text' as const },
      { name: 'name', label: 'Name', dbType: 'string' as const, displayType: 'text' as const },
      { name: 'description', label: 'Description', dbType: 'string' as const, displayType: 'text' as const }
    ]
    const ctx = buildContextFromInputs(inputs, source)
    expect(ctx).toEqual({ id: 'r:1', name: 'Acme', description: 'A company' })
  })

  it('fills defaults and skips missing optional fields', () => {
    const source = { id: 'r:2' }
    const inputs = [
      { name: 'id', label: 'ID', dbType: 'record' as const, displayType: 'text' as const },
      { name: 'status', label: 'Status', dbType: 'string' as const, displayType: 'text' as const, defaultValue: 'pending' },
      { name: 'description', label: 'Description', dbType: 'string' as const, displayType: 'text' as const }
    ]
    const ctx = buildContextFromInputs(inputs, source)
    expect(ctx).toEqual({ id: 'r:2', status: 'pending' })
    expect(ctx).not.toHaveProperty('description')
  })

  it('treats null as missing and falls back to default', () => {
    const source = { id: 'r:4', status: null }
    const inputs = [
      { name: 'id', label: 'ID', dbType: 'record' as const, displayType: 'text' as const },
      { name: 'status', label: 'Status', dbType: 'string' as const, displayType: 'text' as const, defaultValue: 'pending' }
    ]
    const ctx = buildContextFromInputs(inputs, source)
    expect(ctx).toEqual({ id: 'r:4', status: 'pending' })
  })

  it('throws when required input is missing without default', () => {
    const source = { id: 'r:3' }
    const inputs = [
      { name: 'id', label: 'ID', dbType: 'record' as const, displayType: 'text' as const },
      { name: 'name', label: 'Name', dbType: 'string' as const, displayType: 'text' as const, required: true }
    ]
    expect(() => buildContextFromInputs(inputs, source)).toThrow('Missing required input: name')
  })
})
