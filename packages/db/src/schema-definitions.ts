// packages/db/src/schema-definitions.ts

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

export interface RelationDefinition {
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  linkTable?: string
}

export interface TableSchemaDefinition {
  name: string
  label?: string
  description?: string
  hidden?: boolean
  columns: ColumnDefinition[]
  relations?: RelationDefinition[]
}

const opts = (values: string[]) => values.map((v) => ({ label: v, value: v }))

const rel = (fromColumn: string, toTable: string, type: RelationDefinition['type'] = 'many-to-many'): RelationDefinition => ({
  fromTable: '',
  fromColumn,
  toTable,
  toColumn: 'id',
  type,
})

const table = (name: string, label: string, columns: ColumnDefinition[], relations?: RelationDefinition[]): TableSchemaDefinition => ({
  name,
  label,
  columns,
  relations: relations?.map((r) => ({ ...r, fromTable: name })),
})

const c = (
  name: string,
  dbType: ColumnDefinition['dbType'],
  displayType: ColumnDefinition['displayType'],
  extra: Partial<ColumnDefinition> = {}
): ColumnDefinition => ({ name, dbType, displayType, optional: true, ...extra })

export const SYSTEM_COLUMNS: ColumnDefinition[] = [
  { name: 'id', dbType: 'record', displayType: 'text', system: true, optional: false, hidden: false },
  { name: 'createdAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'createdBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true, config: { displayType: 'relation' } },
  { name: 'updatedAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'updatedBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true, config: { displayType: 'relation' } },
  { name: 'deletedAt', dbType: 'datetime', displayType: 'date', system: true, optional: true, hidden: true },
  { name: 'deletedBy', dbType: 'record', displayType: 'relation', system: true, optional: true, hidden: true, config: { displayType: 'relation' } },
]

export const PLATFORM_TABLE_SCHEMAS: TableSchemaDefinition[] = [
  table('companies', 'Companies', [
    c('name', 'string', 'text'),
    c('slug', 'string', 'text', { unique: true }),
    c('namespace', 'string', 'text'),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['active', 'inactive']) } }),
  ]),
  table('platform_users', 'Platform Users', [
    c('email', 'string', 'email', { unique: true }),
    c('password', 'string', 'text', { hidden: true }),
  ]),
  table('accounts', 'Accounts', [
    c('provider', 'string', 'select', { config: { displayType: 'select', options: opts(['email', 'oauth_google', 'oauth_github', 'phone']) } }),
    c('providerKey', 'string', 'text'),
    c('credential', 'string', 'text', { hidden: true }),
    c('profileId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:accounts:profileId:user_profiles' } }),
  ], [rel('profileId', 'user_profiles')]),
  table('user_profiles', 'User Profiles', [
    c('name', 'string', 'text'),
    c('gender', 'string', 'select', { config: { displayType: 'select', options: opts(['male', 'female', 'other', 'prefer_not_to_say']) } }),
    c('birthday', 'datetime', 'date'),
    c('preferences', 'object', 'text'),
  ]),
  table('workflows', 'Workflows', [
    c('name', 'string', 'text'),
    c('xstateConfig', 'object', 'text'),
  ]),
  table('triggers', 'Triggers', [
    c('tableName', 'string', 'text'),
    c('event', 'string', 'select', { config: { displayType: 'select', options: opts(['insert', 'update', 'delete']) } }),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:triggers:workflowId:workflows' } }),
  ], [rel('workflowId', 'workflows')]),
  table('workflow_instances', 'Workflow Instances', [
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_instances:workflowId:workflows' } }),
    c('tableName', 'string', 'text'),
    c('recordId', 'record', 'relation'),
    c('namespace', 'string', 'text'),
    c('companyId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_instances:companyId:companies' } }),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['pending', 'running', 'waiting', 'done', 'error']) } }),
    c('context', 'object', 'text'),
  ], [rel('workflowId', 'workflows'), rel('companyId', 'companies')]),
  table('user_tasks', 'User Tasks', [
    c('instanceId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:user_tasks:instanceId:workflow_instances' } }),
    c('type', 'string', 'select', { config: { displayType: 'select', options: opts(['approval', 'review', 'manual']) } }),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['pending', 'completed', 'cancelled', 'rejected']) } }),
    c('tableName', 'string', 'text'),
    c('recordId', 'record', 'relation'),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:user_tasks:workflowId:workflows' } }),
    c('resolvedAt', 'datetime', 'date'),
  ], [rel('instanceId', 'workflow_instances'), rel('workflowId', 'workflows')]),
  table('workflow_actions', 'Workflow Actions', [
    c('instanceId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_actions:instanceId:workflow_instances' } }),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_actions:workflowId:workflows' } }),
    c('stateId', 'string', 'text'),
    c('action', 'string', 'text'),
    c('params', 'object', 'text'),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['started', 'completed', 'failed']) } }),
    c('inputContext', 'object', 'text'),
    c('outputContext', 'object', 'text'),
    c('outputData', 'object', 'text'),
    c('resultEvent', 'string', 'select', { config: { displayType: 'select', options: opts(['ok', 'error', 'true', 'false']) } }),
    c('errorMessage', 'string', 'text'),
    c('startedAt', 'datetime', 'date'),
    c('completedAt', 'datetime', 'date'),
  ], [rel('instanceId', 'workflow_instances'), rel('workflowId', 'workflows')]),
  table('health_checks', 'Health Checks', [
    c('service', 'string', 'text'),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['healthy', 'unhealthy']) } }),
    c('checkedAt', 'datetime', 'date'),
    c('responseTimeMs', 'number', 'number'),
    c('message', 'string', 'text'),
    c('details', 'object', 'text'),
  ]),
]

export const TENANT_TABLE_SCHEMAS: TableSchemaDefinition[] = [
  table('members', 'Members', [
    c('profileId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:members:profileId:user_profiles' } }),
    c('email', 'string', 'email'),
    c('role', 'string', 'select', { config: { displayType: 'select', options: opts(['owner', 'admin', 'member']) } }),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['pending', 'active', 'inactive']) } }),
    c('inviteCode', 'string', 'text', { unique: true }),
    c('joinedAt', 'datetime', 'date'),
    c('invitedBy', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:members:invitedBy:members' } }),
  ], [rel('profileId', 'user_profiles'), rel('invitedBy', 'members', 'one-to-many')]),
  table('workflows', 'Workflows', [
    c('name', 'string', 'text'),
    c('xstateConfig', 'object', 'text'),
  ]),
  table('triggers', 'Triggers', [
    c('tableName', 'string', 'text'),
    c('event', 'string', 'select', { config: { displayType: 'select', options: opts(['insert', 'update', 'delete']) } }),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:triggers:workflowId:workflows' } }),
  ], [rel('workflowId', 'workflows')]),
  table('workflow_instances', 'Workflow Instances', [
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_instances:workflowId:workflows' } }),
    c('tableName', 'string', 'text'),
    c('recordId', 'record', 'relation'),
    c('namespace', 'string', 'text'),
    c('companyId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_instances:companyId:companies' } }),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['pending', 'running', 'waiting', 'done', 'error']) } }),
    c('context', 'object', 'text'),
  ], [rel('workflowId', 'workflows'), rel('companyId', 'companies')]),
  table('user_tasks', 'User Tasks', [
    c('instanceId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:user_tasks:instanceId:workflow_instances' } }),
    c('type', 'string', 'select', { config: { displayType: 'select', options: opts(['approval', 'review', 'manual']) } }),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['pending', 'completed', 'cancelled', 'rejected']) } }),
    c('tableName', 'string', 'text'),
    c('recordId', 'record', 'relation'),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:user_tasks:workflowId:workflows' } }),
    c('resolvedAt', 'datetime', 'date'),
  ], [rel('instanceId', 'workflow_instances'), rel('workflowId', 'workflows')]),
  table('workflow_actions', 'Workflow Actions', [
    c('instanceId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_actions:instanceId:workflow_instances' } }),
    c('workflowId', 'record', 'relation', { config: { displayType: 'relation', relationId: 'relations:workflow_actions:workflowId:workflows' } }),
    c('stateId', 'string', 'text'),
    c('action', 'string', 'text'),
    c('params', 'object', 'text'),
    c('status', 'string', 'select', { config: { displayType: 'select', options: opts(['started', 'completed', 'failed']) } }),
    c('inputContext', 'object', 'text'),
    c('outputContext', 'object', 'text'),
    c('outputData', 'object', 'text'),
    c('resultEvent', 'string', 'select', { config: { displayType: 'select', options: opts(['ok', 'error', 'true', 'false']) } }),
    c('errorMessage', 'string', 'text'),
    c('startedAt', 'datetime', 'date'),
    c('completedAt', 'datetime', 'date'),
  ], [rel('instanceId', 'workflow_instances'), rel('workflowId', 'workflows')]),
]
