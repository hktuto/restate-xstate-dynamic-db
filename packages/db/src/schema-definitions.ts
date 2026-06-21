// packages/db/src/schema-definitions.ts
import type {
  CardLayoutNode,
  CardViewConfig,
  ColumnDefinition,
  FilterSetting,
  GroupSetting,
  KanbanViewConfig,
  RelationDefinition,
  SortSetting,
  TableColumnConfig,
  TableSchemaDefinition,
  TableViewConfig,
  ViewConfig,
  ViewDefinition,
} from 'shared'

export type {
  CardLayoutNode,
  CardViewConfig,
  ColumnDefinition,
  FilterSetting,
  GroupSetting,
  KanbanViewConfig,
  RelationDefinition,
  SortSetting,
  TableColumnConfig,
  TableSchemaDefinition,
  TableViewConfig,
  ViewConfig,
  ViewDefinition,
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
    column('slug', 'string', 'tag', { unique: true, config: { displayType: 'tag', defaultColor: 'gray' } }),
    column('namespace', 'string', 'text'),
    column('status', 'string', 'tag', { config: { displayType: 'tag', tagColors: { active: 'green', inactive: 'red' }, defaultColor: 'gray' } }),
  ]),
  table('sessions', 'Sessions', [
    column('refreshTokenHash', 'string', 'text', { unique: true }),
    column('accessTokenJti', 'string', 'text'),
    column('accountId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:accountId:accounts:id⟩' } }),
    column('profileId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:profileId:user_profiles:id⟩' } }),
    column('platformUserId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:platformUserId:platform_users:id⟩' } }),
    column('email', 'string', 'text'),
    column('type', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['user', 'impersonation']) } }),
    column('impersonatorId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:impersonatorId:user_profiles:id⟩' } }),
    column('companyId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:companyId:companies:id⟩' } }),
    column('deviceFingerprint', 'string', 'text'),
    column('deviceName', 'string', 'text'),
    column('ip', 'string', 'text'),
    column('userAgent', 'string', 'text'),
    column('refreshExpiresAt', 'datetime', 'date'),
    column('accessExpiresAt', 'datetime', 'date'),
    column('lastUsedAt', 'datetime', 'date'),
    column('revokedAt', 'datetime', 'date'),
    column('revokeReason', 'string', 'text'),
  ], [relation('accountId', 'accounts'), relation('profileId', 'user_profiles'), relation('platformUserId', 'platform_users'), relation('impersonatorId', 'user_profiles'), relation('companyId', 'companies')]),
  table('platform_users', 'Platform Users', [
    column('email', 'string', 'email', { unique: true }),
    column('password', 'string', 'text', { hidden: true }),
  ]),
  table('admin_user_groups', 'Admin User Groups', [
    column('name', 'string', 'text'),
    column('description', 'string', 'text', { optional: true }),
  ]),
  table('resource_types', 'Resource Types', [
    column('name', 'string', 'text'),
    column('table', 'string', 'text'),
    column('hasRecordId', 'boolean', 'checkbox'),
    column('bitMapping', 'array', 'json'),
    column('defaultGroups', 'array', 'json'),
    column('parentResourceType', 'string', 'text', { optional: true }),
    column('isSystem', 'boolean', 'checkbox'),
    column('scope', 'string', 'text'),
  ]),
  table('accounts', 'Accounts', [
    column('provider', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['email', 'oauth_google', 'oauth_github', 'phone']) } }),
    column('providerKey', 'string', 'text'),
    column('credential', 'string', 'text', { hidden: true }),
    column('profileId', 'record', 'relation', { config: { relationId: '_relations:⟨accounts:profileId:user_profiles:id⟩' } }),
  ], [relation('profileId', 'user_profiles')]),
  table('user_profiles', 'User Profiles', [
    column('name', 'string', 'text'),
    column('gender', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['male', 'female', 'other', 'prefer_not_to_say']) } }),
    column('birthday', 'datetime', 'date'),
    column('preferences', 'object', 'text'),
  ]),
  table('workflow_designs', 'Workflow Designs', [
    column('name', 'string', 'text'),
    column('xstateConfig', 'object', 'json'),
    column('starts', 'array', 'json', {
      fields: [
        column('type', 'string', 'select', {
          config: { options: buildOptions(['db_trigger', 'user_trigger', 'cron', 'webhook']) },
        }),
        column('startState', 'string', 'text'),
        column('options', 'object', 'json', { optional: true }),
      ],
    }),
  ]),
  table('workflow_instances', 'Workflow Instances', [
    column('designId', 'record', 'relation', { config: { relationId: '_relations:⟨workflow_instances:designId:workflow_designs:id⟩' } }),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['pending', 'running', 'waiting', 'done', 'error']) } }),
    column('currentState', 'string', 'text'),
    column('context', 'object', 'json'),
    column('triggerBy', 'object', 'json', {
      fields: [
        column('type', 'string', 'select', {
          config: { options: buildOptions(['db_trigger', 'user_trigger', 'cron', 'webhook']) },
        }),
        column('startState', 'string', 'text'),
      ],
    }),
    column('namespace', 'string', 'text'),
    column('companyId', 'record', 'relation', { config: { relationId: '_relations:⟨workflow_instances:companyId:companies:id⟩' } }),
  ], [relation('designId', 'workflow_designs'), relation('companyId', 'companies')]),
  table('user_tasks', 'User Tasks', [
    column('instanceId', 'record', 'relation', { config: { relationId: '_relations:⟨user_tasks:instanceId:workflow_instances:id⟩' } }),
    column('type', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['approval', 'review', 'manual']) } }),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['pending', 'completed', 'cancelled', 'rejected']) } }),
    column('tableName', 'string', 'text'),
    column('recordId', 'record', 'text'),
    column('designId', 'record', 'relation', { config: { relationId: '_relations:⟨user_tasks:designId:workflow_designs:id⟩' } }),
    column('resolvedAt', 'datetime', 'date'),
  ], [relation('instanceId', 'workflow_instances'), relation('designId', 'workflow_designs')]),
  table('workflow_actions', 'Workflow Actions', [
    column('instanceId', 'record', 'relation', { config: { relationId: '_relations:⟨workflow_actions:instanceId:workflow_instances:id⟩' } }),
    column('designId', 'record', 'relation', { config: { relationId: '_relations:⟨workflow_actions:designId:workflow_designs:id⟩' } }),
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
  ], [relation('instanceId', 'workflow_instances'), relation('designId', 'workflow_designs')]),
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
    column('profileId', 'record', 'relation', { config: { relationId: '_relations:⟨members:profileId:user_profiles:id⟩' } }),
    column('email', 'string', 'email'),
    column('role', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['owner', 'admin', 'member']) } }),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['pending', 'active', 'inactive']) } }),
    column('inviteCode', 'string', 'text', { unique: true }),
    column('joinedAt', 'datetime', 'date'),
    column('invitedBy', 'record', 'relation', { config: { relationId: '_relations:⟨members:invitedBy:members:id⟩' } }),
  ], [relation('profileId', 'user_profiles'), relation('invitedBy', 'members', 'one-to-many')]),
  table('sessions', 'Sessions', [
    column('platformSessionId', 'string', 'text'),
    column('memberId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:memberId:members:id⟩' } }),
    column('profileId', 'string', 'text'),
    column('email', 'string', 'text'),
    column('companyId', 'string', 'text'),
    column('type', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['user', 'impersonation']) } }),
    column('impersonatorId', 'record', 'relation', { config: { relationId: '_relations:⟨sessions:impersonatorId:members:id⟩' } }),
    column('deviceFingerprint', 'string', 'text'),
    column('deviceName', 'string', 'text'),
    column('ip', 'string', 'text'),
    column('userAgent', 'string', 'text'),
    column('lastUsedAt', 'datetime', 'date'),
    column('revokedAt', 'datetime', 'date'),
    column('revokeReason', 'string', 'text'),
  ], [relation('memberId', 'members'), relation('impersonatorId', 'members')]),
  table('workflow_designs', 'Workflow Designs', [
    column('name', 'string', 'text'),
    column('xstateConfig', 'object', 'json'),
    column('starts', 'array', 'json', {
      fields: [
        column('type', 'string', 'select', {
          config: { options: buildOptions(['db_trigger', 'user_trigger', 'cron', 'webhook']) },
        }),
        column('startState', 'string', 'text'),
        column('options', 'object', 'json', { optional: true }),
      ],
    }),
  ]),
  table('workflow_instances', 'Workflow Instances', [
    column('designId', 'record', 'relation', { config: { relationId: '_relations:⟨workflow_instances:designId:workflow_designs:id⟩' } }),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['pending', 'running', 'waiting', 'done', 'error']) } }),
    column('currentState', 'string', 'text'),
    column('context', 'object', 'json'),
    column('triggerBy', 'object', 'json', {
      fields: [
        column('type', 'string', 'select', {
          config: { options: buildOptions(['db_trigger', 'user_trigger', 'cron', 'webhook']) },
        }),
        column('startState', 'string', 'text'),
      ],
    }),
    column('namespace', 'string', 'text'),
    column('companyId', 'string', 'text'),
  ], [relation('designId', 'workflow_designs')]),
  table('user_tasks', 'User Tasks', [
    column('instanceId', 'record', 'relation', { config: { relationId: '_relations:⟨user_tasks:instanceId:workflow_instances:id⟩' } }),
    column('type', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['approval', 'review', 'manual']) } }),
    column('status', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['pending', 'completed', 'cancelled', 'rejected']) } }),
    column('tableName', 'string', 'text'),
    column('recordId', 'record', 'text'),
    column('designId', 'record', 'relation', { config: { relationId: '_relations:⟨user_tasks:designId:workflow_designs:id⟩' } }),
    column('resolvedAt', 'datetime', 'date'),
  ], [relation('instanceId', 'workflow_instances'), relation('designId', 'workflow_designs')]),
  table('workflow_actions', 'Workflow Actions', [
    column('instanceId', 'record', 'relation', { config: { relationId: '_relations:⟨workflow_actions:instanceId:workflow_instances:id⟩' } }),
    column('designId', 'record', 'relation', { config: { relationId: '_relations:⟨workflow_actions:designId:workflow_designs:id⟩' } }),
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
  ], [relation('instanceId', 'workflow_instances'), relation('designId', 'workflow_designs')]),
  table('permission_groups', 'Permission Groups', [
    column('resourceType', 'string', 'text'),
    column('recordId', 'string', 'text', { optional: true }),
    column('name', 'string', 'text'),
    column('isSystem', 'boolean', 'checkbox'),
    column('description', 'string', 'text', { optional: true }),
  ]),
  table('resource_types', 'Resource Types', [
    column('name', 'string', 'text'),
    column('table', 'string', 'text'),
    column('hasRecordId', 'boolean', 'checkbox'),
    column('bitMapping', 'array', 'json'),
    column('defaultGroups', 'array', 'json'),
    column('parentResourceType', 'string', 'text', { optional: true }),
    column('isSystem', 'boolean', 'checkbox'),
    column('scope', 'string', 'text'),
  ]),
  table('user_groups', 'User Groups', [
    column('name', 'string', 'text'),
    column('description', 'string', 'text', { optional: true }),
  ]),
  table('_views', 'Views', [
    column('table', 'string', 'text'),
    column('type', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['table']) } }),
    column('name', 'string', 'text'),
    column('description', 'string', 'text', { optional: true }),
    column('isDefault', 'boolean', 'checkbox', { defaultValue: false }),
    column('config', 'object', 'json'),
    column('group', 'object', 'json', { optional: true }),
    column('filter', 'object', 'json', { optional: true }),
    column('sort', 'array', 'json', { optional: true }),
  ]),
  table('company_policies', 'Company Policies', [
    column('companyId', 'string', 'text'),
    column('maxSessions', 'number', 'number', { optional: true }),
    column('sessionOverflowAction', 'string', 'select', { config: { displayType: 'select', options: buildOptions(['revoke_oldest', 'reject']) } }),
    column('allowImpersonation', 'boolean', 'checkbox'),
    column('allowApiKeys', 'boolean', 'checkbox'),
  ]),
]
