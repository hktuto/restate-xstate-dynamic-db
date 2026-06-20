import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('db/schema-registry', () => ({
  getTableSchema: vi.fn(),
}))

import { getTableSchema } from 'db/schema-registry'
import { resolveInputs } from '../src/catalog/resolve-inputs.js'

function createDefinition(table: string) {
  return {
    id: 'test',
    initial: 'start',
    states: {
      start: {
        meta: {
          action: 'createRecord',
          params: { table },
        },
      },
    },
  } as any
}

beforeEach(() => vi.clearAllMocks())

describe('resolveInputs', () => {
  it('expands a plain nested object column', async () => {
    ;(getTableSchema as any).mockResolvedValue({
      table: { name: 'contacts' },
      columns: [
        {
          name: 'name',
          dbType: 'string',
          displayType: 'text',
          optional: false,
          label: 'Full Name',
        },
        {
          name: 'address',
          dbType: 'object',
          displayType: 'json',
          optional: true,
          label: 'Address',
          fields: [
            {
              name: 'street',
              dbType: 'string',
              displayType: 'text',
              optional: false,
              label: 'Street',
            },
            {
              name: 'city',
              dbType: 'string',
              displayType: 'text',
              optional: true,
              label: 'City',
            },
          ],
        },
      ],
      relations: [],
    })

    const inputs = await resolveInputs('ns', createDefinition('contacts'), 'start')
    expect(inputs).toHaveLength(2)

    const address = inputs.find((i) => i.name === 'address')
    expect(address).toMatchObject({
      name: 'address',
      label: 'Address',
      dbType: 'object',
      displayType: 'json',
      required: false,
    })
    expect(address?.fields?.map((f) => [f.name, f.dbType, f.displayType, f.label, f.required])).toEqual([
      ['street', 'string', 'text', 'Street', true],
      ['city', 'string', 'text', 'City', false],
    ])
  })

  it('expands an array-of-object column', async () => {
    ;(getTableSchema as any).mockResolvedValue({
      table: { name: 'invoices' },
      columns: [
        {
          name: 'invoiceLines',
          dbType: 'array',
          displayType: 'json',
          optional: true,
          label: 'Invoice Lines',
          fields: [
            {
              name: 'id',
              dbType: 'string',
              displayType: 'text',
              optional: false,
              label: 'Line ID',
            },
            {
              name: 'total',
              dbType: 'number',
              displayType: 'number',
              optional: false,
              label: 'Total',
            },
          ],
        },
      ],
      relations: [],
    })

    const inputs = await resolveInputs('ns', createDefinition('invoices'), 'start')
    expect(inputs).toHaveLength(1)

    const invoiceLines = inputs[0]
    expect(invoiceLines).toMatchObject({
      name: 'invoiceLines',
      label: 'Invoice Lines',
      dbType: 'array',
      displayType: 'json',
      required: false,
    })
    expect(invoiceLines.fields?.map((f) => [f.name, f.dbType, f.displayType, f.label, f.required])).toEqual([
      ['id', 'string', 'text', 'Line ID', true],
      ['total', 'number', 'number', 'Total', true],
    ])
  })

  it('expands deeply nested object fields', async () => {
    ;(getTableSchema as any).mockResolvedValue({
      table: { name: 'companies' },
      columns: [
        {
          name: 'organization',
          dbType: 'object',
          displayType: 'json',
          optional: true,
          label: 'Organization',
          fields: [
            {
              name: 'name',
              dbType: 'string',
              displayType: 'text',
              optional: false,
              label: 'Org Name',
            },
            {
              name: 'address',
              dbType: 'object',
              displayType: 'json',
              optional: true,
              label: 'Org Address',
              fields: [
                {
                  name: 'zip',
                  dbType: 'string',
                  displayType: 'text',
                  optional: false,
                  label: 'ZIP Code',
                },
              ],
            },
          ],
        },
      ],
      relations: [],
    })

    const inputs = await resolveInputs('ns', createDefinition('companies'), 'start')
    expect(inputs).toHaveLength(1)

    const organization = inputs[0]
    expect(organization).toMatchObject({
      name: 'organization',
      label: 'Organization',
      dbType: 'object',
      displayType: 'json',
      required: false,
    })
    expect(organization.fields?.map((f) => [f.name, f.dbType, f.displayType, f.label, f.required])).toEqual([
      ['name', 'string', 'text', 'Org Name', true],
      ['address', 'object', 'json', 'Org Address', false],
    ])

    const nestedAddress = organization.fields?.find((f) => f.name === 'address')
    expect(nestedAddress?.fields?.map((f) => [f.name, f.dbType, f.displayType, f.label, f.required])).toEqual([
      ['zip', 'string', 'text', 'ZIP Code', true],
    ])
  })
})
