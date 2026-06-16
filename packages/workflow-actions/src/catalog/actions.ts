import type { ActionMetadata } from 'shared'

export const actionsMetadata: ActionMetadata[] = [
  {
    id: 'getRecord',
    label: 'Get record(s)',
    description: 'Query records from a table.',
    category: 'Database',
    paramsSchema: {
      table: { type: 'string', label: 'Table', required: true },
      filter: { type: 'json', label: 'Filter', required: false, default: {} },
      result: { type: 'json', label: 'Result options', required: false, default: { type: 'first' }, description: "Use { type: 'first' } or { type: 'list' }." }
    }
  },
  {
    id: 'createRecord',
    label: 'Create record',
    description: 'Insert a new record into a table.',
    category: 'Database',
    paramsSchema: {
      table: { type: 'string', label: 'Table', required: true },
      fields: { type: 'json', label: 'Fields', required: true }
    }
  },
  {
    id: 'updateRecord',
    label: 'Update record',
    description: 'Update fields on an existing record.',
    category: 'Database',
    paramsSchema: {
      table: { type: 'string', label: 'Table', required: true },
      id: { type: 'string', label: 'Record ID', required: false, description: 'Defaults to context.record.id if omitted.' },
      fields: { type: 'json', label: 'Fields', required: true }
    }
  },
  {
    id: 'deleteRecord',
    label: 'Delete record',
    description: 'Soft or hard delete a record.',
    category: 'Database',
    paramsSchema: {
      table: { type: 'string', label: 'Table', required: true },
      id: { type: 'string', label: 'Record ID', required: false, description: 'Defaults to context.record.id if omitted.' },
      mode: {
        type: 'select',
        label: 'Mode',
        required: false,
        default: 'soft',
        options: [
          { label: 'Soft delete', value: 'soft' },
          { label: 'Hard delete', value: 'hard' }
        ]
      }
    }
  },
  {
    id: 'condition',
    label: 'Condition',
    description: 'Evaluate a MongoDB-style expression and return true or false.',
    category: 'Logic',
    paramsSchema: {
      expression: { type: 'json', label: 'Expression', required: true }
    }
  }
]
