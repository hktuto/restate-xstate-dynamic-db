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
      result: { type: 'json', label: 'Result options', required: false, default: { type: 'first' } }
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
      id: { type: 'string', label: 'Record ID', required: false },
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
      id: { type: 'string', label: 'Record ID', required: false },
      mode: {
        type: 'select',
        label: 'Mode',
        required: true,
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
    description: 'Branch based on a MongoDB-style expression.',
    category: 'Logic',
    paramsSchema: {
      expression: { type: 'json', label: 'Expression', required: true }
    }
  }
]
