// packages/db/src/schema-definitions.ts

/** Supported SurrealDB column data types. */
export interface ColumnDefinition {
  name: string
  label?: string
  dbType: 'string' | 'number' | 'boolean' | 'datetime' | 'object' | 'array' | 'record'
  displayType: 'text' | 'url' | 'email' | 'user' | 'select' | 'checkbox' | 'date' | 'number' | 'relation' | 'formula' | 'richText'
  config?: Record<string, unknown>
  system?: boolean
  unique?: boolean
  uniqueScope?: string
  optional?: boolean
  defaultValue?: unknown
  hidden?: boolean
  order?: number
}

/** Defines a directed relation between a column in one table and a column in another table. */
export interface RelationDefinition {
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  linkTable?: string
}

/** Complete schema for a single table, including columns and optional relations. */
export interface TableSchemaDefinition {
  name: string
  label?: string
  description?: string
  hidden?: boolean
  columns: ColumnDefinition[]
  relations?: RelationDefinition[]
}

/** Build a list of select options from raw string values. */
const buildOptions = (values: string[]) => values.map((v) => ({ label: v, value: v }))

/** Declare a relation from a column in the current table to another table. */
const relation = (
  fromColumn: string,
  toTable: string,
  type: RelationDefinition['type'] = 'many-to-many'
): Omit<RelationDefinition, 'fromTable'> => ({
  fromColumn,
  toTable,
  toColumn: 'id',
  type,
})

/** Build a table schema, injecting the table name into each declared relation. */
const table = (
  name: string,
  label: string,
  columns: ColumnDefinition[],
  relations?: Omit<RelationDefinition, 'fromTable'>[]
): TableSchemaDefinition => ({
  name,
  label,
  columns,
  relations: relations?.map((r) => ({ ...r, fromTable: name })),
})

/** Build a column definition. Name, dbType, and displayType cannot be overridden via `extra`. */
const column = (
  name: string,
  dbType: ColumnDefinition['dbType'],
  displayType: ColumnDefinition['displayType'],
  extra: Omit<Partial<ColumnDefinition>, 'name' | 'dbType' | 'displayType'> = {}
): ColumnDefinition => ({ name, dbType, displayType, optional: true, ...extra })

/** System columns added automatically to every table. */
export const SYSTEM_COLUMNS: ColumnDefinition[] = [
  { name: 'id', dbType: 'record', displayType: 'text', system: true, optional: false, hidden: false },
  { name: 'createdAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'createdBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true },
  { name: 'updatedAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'updatedBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true },
  { name: 'deletedAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'deletedBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true },
]

/** Platform-level table schemas, available across all tenants. */
export const PLATFORM_TABLE_SCHEMAS: TableSchemaDefinition[] = [
  table('companies', 'Companies', [
    column('name', 'string', 'text'),
    column('slug', 'string', 'text', { unique: true }),
    column('namespace', 'string', 'text'),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['active', 'inactive']) } }),
  ]),
  table('platform_users', 'Platform Users', [
    column('email', 'string', 'email', { unique: true }),
    column('password', 'string', 'text', { hidden: true }),
  ]),
  table('accounts', 'Accounts', [
    column('provider', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['email', 'oauth_google', 'oauth_github', 'phone']) } }),
    column('providerKey', 'string', 'text'),
    column('credential', 'string', 'text', { hidden: true }),
    column('profileId', 'record', 'relation', { config: { relationId: 'relations:accounts:profileId:user_profiles' } }),
  ], [relation('profileId', 'user_profiles')]),
  table('user_profiles', 'User Profiles', [
    column('name', 'string', 'text'),
    column('gender', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['male', 'female', 'other', 'prefer_not_to_say']) } }),
    column('birthday', 'datetime', 'date'),
    column('preferences', 'object', 'text'),
  ]),
  table('workflows', 'Workflows', [
    column('name', 'string', 'text'),
    column('xstateConfig', 'object', 'text'),
  ]),
  table('triggers', 'Triggers', [
    column('tableName', 'string', 'text'),
    column('event', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['insert', 'update', 'delete']) } }),
    column('workflowId', 'record', 'relation', { config: { relationId: 'relations:triggers:workflowId:workflows' } }),
  ], [relation('workflowId', 'workflows')]),
  table('workflow_instances', 'Workflow Instances', [
    column('workflowId', 'record', 'relation', { config: { relationId: 'relations:workflow_instances:workflowId:workflows' } }),
    column('tableName', 'string', 'text'),
    column('recordId', 'record', 'text'),
    column('namespace', 'string', 'text'),
    column('companyId', 'record', 'relation', { config: { relationId: 'relations:workflow_instances:companyId:companies' } }),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['pending', 'running', 'waiting', 'done', 'error']) } }),
    column('context', 'object', 'text'),
  ], [relation('workflowId', 'workflows'), relation('companyId', 'companies')]),
  table('user_tasks', 'User Tasks', [
    column('instanceId', 'record', 'relation', { config: { relationId: 'relations:user_tasks:instanceId:workflow_instances' } }),
    column('type', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['approval', 'review', 'manual']) } }),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['pending', 'completed', 'cancelled', 'rejected']) } }),
    column('tableName', 'string', 'text'),
    column('recordId', 'record', 'text'),
    column('workflowId', 'record', 'relation', { config: { relationId: 'relations:user_tasks:workflowId:workflows' } }),
    column('resolvedAt', 'datetime', 'date'),
  ], [relation('instanceId', 'workflow_instances'), relation('workflowId', 'workflows')]),
  table('workflow_actions', 'Workflow Actions', [
    column('instanceId', 'record', 'relation', { config: { relationId: 'relations:workflow_actions:instanceId:workflow_instances' } }),
    column('workflowId', 'record', 'relation', { config: { relationId: 'relations:workflow_actions:workflowId:workflows' } }),
    column('stateId', 'string', 'text'),
    column('action', 'string', 'text'),
    column('params', 'object', 'text'),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['started', 'completed', 'failed']) } }),
    column('inputContext', 'object', 'text'),
    column('outputContext', 'object', 'text'),
    column('outputData', 'object', 'text'),
    column('resultEvent', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['ok', 'error', 'true', 'false']) } }),
    column('errorMessage', 'string', 'text'),
    column('startedAt', 'datetime', 'date'),
    column('completedAt', 'datetime', 'date'),
  ], [relation('instanceId', 'workflow_instances'), relation('workflowId', 'workflows')]),
  table('health_checks', 'Health Checks', [
    column('service', 'string', 'text'),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['healthy', 'unhealthy']) } }),
    column('checkedAt', 'datetime', 'date'),
    column('responseTimeMs', 'number', 'number'),
    column('message', 'string', 'text'),
    column('details', 'object', 'text'),
  ]),
]

/** Tenant-level table schemas, provisioned inside each company namespace. */
export const TENANT_TABLE_SCHEMAS: TableSchemaDefinition[] = [
  table('members', 'Members', [
    column('profileId', 'record', 'relation', { config: { relationId: 'relations:members:profileId:user_profiles' } }),
    column('email', 'string', 'email'),
    column('role', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['owner', 'admin', 'member']) } }),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['pending', 'active', 'inactive']) } }),
    column('inviteCode', 'string', 'text', { unique: true }),
    column('joinedAt', 'datetime', 'date'),
    column('invitedBy', 'record', 'relation', { config: { relationId: 'relations:members:invitedBy:members' } }),
  ], [relation('profileId', 'user_profiles'), relation('invitedBy', 'members', 'one-to-many')]),
  table('workflows', 'Workflows', [
    column('name', 'string', 'text'),
    column('xstateConfig', 'object', 'text'),
  ]),
  table('triggers', 'Triggers', [
    column('tableName', 'string', 'text'),
    column('event', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['insert', 'update', 'delete']) } }),
    column('workflowId', 'record', 'relation', { config: { relationId: 'relations:triggers:workflowId:workflows' } }),
  ], [relation('workflowId', 'workflows')]),
  table('workflow_instances', 'Workflow Instances', [
    column('workflowId', 'record', 'relation', { config: { relationId: 'relations:workflow_instances:workflowId:workflows' } }),
    column('tableName', 'string', 'text'),
    column('recordId', 'record', 'text'),
    column('namespace', 'string', 'text'),
    column('companyId', 'record', 'relation', { config: { relationId: 'relations:workflow_instances:companyId:companies' } }),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['pending', 'running', 'waiting', 'done', 'error']) } }),
    column('context', 'object', 'text'),
  ], [relation('workflowId', 'workflows'), relation('companyId', 'companies')]),
  table('user_tasks', 'User Tasks', [
    column('instanceId', 'record', 'relation', { config: { relationId: 'relations:user_tasks:instanceId:workflow_instances' } }),
    column('type', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['approval', 'review', 'manual']) } }),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['pending', 'completed', 'cancelled', 'rejected']) } }),
    column('tableName', 'string', 'text'),
    column('recordId', 'record', 'text'),
    column('workflowId', 'record', 'relation', { config: { relationId: 'relations:user_tasks:workflowId:workflows' } }),
    column('resolvedAt', 'datetime', 'date'),
  ], [relation('instanceId', 'workflow_instances'), relation('workflowId', 'workflows')]),
  table('workflow_actions', 'Workflow Actions', [
    column('instanceId', 'record', 'relation', { config: { relationId: 'relations:workflow_actions:instanceId:workflow_instances' } }),
    column('workflowId', 'record', 'relation', { config: { relationId: 'relations:workflow_actions:workflowId:workflows' } }),
    column('stateId', 'string', 'text'),
    column('action', 'string', 'text'),
    column('params', 'object', 'text'),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['started', 'completed', 'failed']) } }),
    column('inputContext', 'object', 'text'),
    column('outputContext', 'object', 'text'),
    column('outputData', 'object', 'text'),
    column('resultEvent', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['ok', 'error', 'true', 'false']) } }),
    column('errorMessage', 'string', 'text'),
    column('startedAt', 'datetime', 'date'),
    column('completedAt', 'datetime', 'date'),
  ], [relation('instanceId', 'workflow_instances'), relation('workflowId', 'workflows')]),
]
