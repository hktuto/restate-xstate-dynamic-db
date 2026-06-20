import type { WorkflowDefinition, ActionInputMetadata } from 'shared'
import { getTableSchema } from 'db/schema-registry'
import type { ColumnDefinition } from 'db/schema-definitions'

import { actionsMetadata } from './actions.js'

function toActionDisplayType(displayType: string): ActionInputMetadata['displayType'] {
  const valid: ActionInputMetadata['displayType'][] = ['text', 'email', 'url', 'number', 'select', 'checkbox', 'date', 'json', 'richText']
  return valid.includes(displayType as ActionInputMetadata['displayType']) ? (displayType as ActionInputMetadata['displayType']) : 'text'
}

function mapColumnToInput(column: ColumnDefinition): ActionInputMetadata {
  return {
    name: column.name,
    label: column.label ?? column.name,
    dbType: column.dbType,
    displayType: toActionDisplayType(column.displayType),
    description: column.label,
    required: !column.optional,
    hidden: column.hidden,
    defaultValue: column.defaultValue,
    config: column.config,
    fields: column.fields?.map(mapColumnToInput),
  }
}

export async function resolveInputs(
  namespace: string,
  definition: WorkflowDefinition,
  stateId: string,
  database = 'main'
): Promise<ActionInputMetadata[]> {
  const state = definition.states[stateId]
  const actionId = state?.meta?.action as string | undefined
  if (!actionId) return []
  const meta = actionsMetadata.find((a) => a.id === actionId)
  if (!meta) return []
  if (meta.inputs) return meta.inputs
  if (meta.tableInput) {
    const tableName = (state?.meta?.params as Record<string, unknown>)?.[meta.tableInput] as string | undefined
    if (!tableName) return []
    const schema = await getTableSchema(namespace, database, tableName)
    if (!schema) return []
    return schema.columns
      .filter((c) => !c.system)
      .map(mapColumnToInput)
  }
  return []
}
