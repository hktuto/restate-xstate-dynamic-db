import type { GuardMetadata } from 'shared'

export const guardsMetadata: GuardMetadata[] = [
  {
    id: 'emailContains',
    label: 'Email contains',
    description: 'Matches when the record email contains the given value.',
    paramsSchema: {
      value: {
        type: 'string',
        label: 'Value',
        required: true
      }
    }
  },
  {
    id: 'emailNotContains',
    label: 'Email does not contain',
    description: 'Matches when the record email does not contain the given value.',
    paramsSchema: {
      value: {
        type: 'string',
        label: 'Value',
        required: true
      }
    }
  },
  {
    id: 'recordHasField',
    label: 'Record has field',
    description: 'Matches when the record has a non-empty value for a field.',
    paramsSchema: {
      field: {
        type: 'string',
        label: 'Field name',
        required: true
      }
    }
  }
]
