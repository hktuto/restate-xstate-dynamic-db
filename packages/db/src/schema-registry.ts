// packages/db/src/schema-registry.ts
import { Surreal } from 'surrealdb'
import { getSurreal, closeSurreal } from './client.js'
import {
  type ColumnDefinition,
  type RelationDefinition,
  type SortSetting,
  type TableColumnConfig,
  type TableSchemaDefinition,
  type TableViewConfig,
  type ViewConfig,
  type ViewDefinition,
  type ColumnRow,
  type RelationRow,
  type TableRow,
  type TableSchema,
} from 'shared'
import { normalizeId } from './normalize.js'

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
  {
    name: 'companies',
    label: 'Companies',
    resourceType: 'company',
    columns: [
      { name: 'name', dbType: 'string', displayType: 'text', optional: true },
      { name: 'slug', dbType: 'string', displayType: 'tag', optional: true, unique: true, config: { displayType: 'tag', defaultColor: 'gray' } },
      { name: 'namespace', dbType: 'string', displayType: 'text', optional: true },
      { name: 'status', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }] } },
    ],
    relations: undefined,
  },
  {
    name: 'sessions',
    label: 'Sessions',
    columns: [
      { name: 'refreshTokenHash', dbType: 'string', displayType: 'text', optional: true, unique: true },
      { name: 'accessTokenJti', dbType: 'string', displayType: 'text', optional: true },
      { name: 'accountId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨sessions:accountId:accounts:id⟩' } },
      { name: 'profileId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨sessions:profileId:user_profiles:id⟩' } },
      { name: 'platformUserId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨sessions:platformUserId:platform_users:id⟩' } },
      { name: 'email', dbType: 'string', displayType: 'text', optional: true },
      { name: 'type', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'user', value: 'user' }, { label: 'impersonation', value: 'impersonation' }] } },
      { name: 'impersonatorId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨sessions:impersonatorId:user_profiles:id⟩' } },
      { name: 'companyId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨sessions:companyId:companies:id⟩' } },
      { name: 'deviceFingerprint', dbType: 'string', displayType: 'text', optional: true },
      { name: 'deviceName', dbType: 'string', displayType: 'text', optional: true },
      { name: 'ip', dbType: 'string', displayType: 'text', optional: true },
      { name: 'userAgent', dbType: 'string', displayType: 'text', optional: true },
      { name: 'refreshExpiresAt', dbType: 'datetime', displayType: 'date', optional: true },
      { name: 'accessExpiresAt', dbType: 'datetime', displayType: 'date', optional: true },
      { name: 'lastUsedAt', dbType: 'datetime', displayType: 'date', optional: true },
      { name: 'revokedAt', dbType: 'datetime', displayType: 'date', optional: true },
      { name: 'revokeReason', dbType: 'string', displayType: 'text', optional: true },
    ],
    relations: [
      { kind: 'reference', fromColumn: 'accountId', toTable: 'accounts', toColumn: 'id', type: 'many-to-many', fromTable: 'sessions' },
      { kind: 'reference', fromColumn: 'profileId', toTable: 'user_profiles', toColumn: 'id', type: 'many-to-many', fromTable: 'sessions' },
      { kind: 'reference', fromColumn: 'platformUserId', toTable: 'platform_users', toColumn: 'id', type: 'many-to-many', fromTable: 'sessions' },
      { kind: 'reference', fromColumn: 'impersonatorId', toTable: 'user_profiles', toColumn: 'id', type: 'many-to-many', fromTable: 'sessions' },
      { kind: 'reference', fromColumn: 'companyId', toTable: 'companies', toColumn: 'id', type: 'many-to-many', fromTable: 'sessions' },
    ],
  },
  {
    name: 'platform_users',
    label: 'Platform Users',
    resourceType: 'admin_user',
    columns: [
      { name: 'email', dbType: 'string', displayType: 'email', optional: true, unique: true },
      { name: 'password', dbType: 'string', displayType: 'text', optional: true, hidden: true },
    ],
    relations: undefined,
  },
  {
    name: 'admin_user_groups',
    label: 'Admin User Groups',
    resourceType: 'admin_user_group',
    columns: [
      { name: 'name', dbType: 'string', displayType: 'text', optional: true },
      { name: 'description', dbType: 'string', displayType: 'text', optional: true },
    ],
    relations: undefined,
  },
  {
    name: 'resource_types',
    label: 'Resource Types',
    columns: [
      { name: 'name', dbType: 'string', displayType: 'text', optional: true },
      { name: 'table', dbType: 'string', displayType: 'text', optional: true },
      { name: 'hasRecordId', dbType: 'boolean', displayType: 'checkbox', optional: true },
      { name: 'bitMapping', dbType: 'array', displayType: 'json', optional: true },
      { name: 'defaultGroups', dbType: 'array', displayType: 'json', optional: true },
      { name: 'parentResourceType', dbType: 'string', displayType: 'text', optional: true },
      { name: 'isSystem', dbType: 'boolean', displayType: 'checkbox', optional: true },
      { name: 'scope', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'Platform', value: 'platform' }, { label: 'Tenant', value: 'tenant' }] } },
    ],
    relations: undefined,
  },
  {
    name: 'accounts',
    label: 'Accounts',
    columns: [
      { name: 'provider', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'email', value: 'email' }, { label: 'oauth_google', value: 'oauth_google' }, { label: 'oauth_github', value: 'oauth_github' }, { label: 'phone', value: 'phone' }] } },
      { name: 'providerKey', dbType: 'string', displayType: 'text', optional: true },
      { name: 'credential', dbType: 'string', displayType: 'text', optional: true, hidden: true },
      { name: 'profileId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨accounts:profileId:user_profiles:id⟩' } },
    ],
    relations: [
      { kind: 'reference', fromColumn: 'profileId', toTable: 'user_profiles', toColumn: 'id', type: 'many-to-many', fromTable: 'accounts' },
    ],
  },
  {
    name: 'user_profiles',
    label: 'User Profiles',
    resourceType: 'company_member',
    columns: [
      { name: 'name', dbType: 'string', displayType: 'text', optional: true },
      { name: 'gender', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'male', value: 'male' }, { label: 'female', value: 'female' }, { label: 'other', value: 'other' }, { label: 'prefer_not_to_say', value: 'prefer_not_to_say' }] } },
      { name: 'birthday', dbType: 'datetime', displayType: 'date', optional: true },
      { name: 'preferences', dbType: 'object', displayType: 'text', optional: true },
    ],
    relations: undefined,
  },
  {
    name: 'workflow_designs',
    label: 'Workflow Designs',
    resourceType: 'workflow_design',
    columns: [
      { name: 'name', dbType: 'string', displayType: 'text', optional: true },
      { name: 'xstateConfig', dbType: 'object', displayType: 'json', optional: true },
      { name: 'starts', dbType: 'array', displayType: 'json', optional: true, fields: [
        { name: 'type', dbType: 'string', displayType: 'select', optional: true, config: { options: [{ label: 'db_trigger', value: 'db_trigger' }, { label: 'user_trigger', value: 'user_trigger' }, { label: 'cron', value: 'cron' }, { label: 'webhook', value: 'webhook' }] } },
        { name: 'startState', dbType: 'string', displayType: 'text', optional: true },
        { name: 'options', dbType: 'object', displayType: 'json', optional: true },
      ] },
    ],
    relations: undefined,
  },
  {
    name: 'workflow_instances',
    label: 'Workflow Instances',
    columns: [
      { name: 'designId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨workflow_instances:designId:workflow_designs:id⟩' } },
      { name: 'status', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'pending', value: 'pending' }, { label: 'running', value: 'running' }, { label: 'waiting', value: 'waiting' }, { label: 'done', value: 'done' }, { label: 'error', value: 'error' }] } },
      { name: 'currentState', dbType: 'string', displayType: 'text', optional: true },
      { name: 'context', dbType: 'object', displayType: 'json', optional: true },
      { name: 'triggerBy', dbType: 'object', displayType: 'json', optional: true, fields: [
        { name: 'type', dbType: 'string', displayType: 'select', optional: true, config: { options: [{ label: 'db_trigger', value: 'db_trigger' }, { label: 'user_trigger', value: 'user_trigger' }, { label: 'cron', value: 'cron' }, { label: 'webhook', value: 'webhook' }] } },
        { name: 'startState', dbType: 'string', displayType: 'text', optional: true },
      ] },
      { name: 'namespace', dbType: 'string', displayType: 'text', optional: true },
      { name: 'companyId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨workflow_instances:companyId:companies:id⟩' } },
    ],
    relations: [
      { kind: 'reference', fromColumn: 'designId', toTable: 'workflow_designs', toColumn: 'id', type: 'many-to-many', fromTable: 'workflow_instances' },
      { kind: 'reference', fromColumn: 'companyId', toTable: 'companies', toColumn: 'id', type: 'many-to-many', fromTable: 'workflow_instances' },
    ],
  },
  {
    name: 'user_tasks',
    label: 'User Tasks',
    columns: [
      { name: 'instanceId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨user_tasks:instanceId:workflow_instances:id⟩' } },
      { name: 'type', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'approval', value: 'approval' }, { label: 'review', value: 'review' }, { label: 'manual', value: 'manual' }] } },
      { name: 'status', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'pending', value: 'pending' }, { label: 'completed', value: 'completed' }, { label: 'cancelled', value: 'cancelled' }, { label: 'rejected', value: 'rejected' }] } },
      { name: 'tableName', dbType: 'string', displayType: 'text', optional: true },
      { name: 'recordId', dbType: 'record', displayType: 'text', optional: true },
      { name: 'designId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨user_tasks:designId:workflow_designs:id⟩' } },
      { name: 'resolvedAt', dbType: 'datetime', displayType: 'date', optional: true },
    ],
    relations: [
      { kind: 'reference', fromColumn: 'instanceId', toTable: 'workflow_instances', toColumn: 'id', type: 'many-to-many', fromTable: 'user_tasks' },
      { kind: 'reference', fromColumn: 'designId', toTable: 'workflow_designs', toColumn: 'id', type: 'many-to-many', fromTable: 'user_tasks' },
    ],
  },
  {
    name: 'workflow_actions',
    label: 'Workflow Actions',
    columns: [
      { name: 'instanceId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨workflow_actions:instanceId:workflow_instances:id⟩' } },
      { name: 'designId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨workflow_actions:designId:workflow_designs:id⟩' } },
      { name: 'stateId', dbType: 'string', displayType: 'text', optional: true },
      { name: 'action', dbType: 'string', displayType: 'text', optional: true },
      { name: 'params', dbType: 'object', displayType: 'text', optional: true },
      { name: 'status', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'started', value: 'started' }, { label: 'completed', value: 'completed' }, { label: 'failed', value: 'failed' }] } },
      { name: 'inputContext', dbType: 'object', displayType: 'text', optional: true },
      { name: 'outputContext', dbType: 'object', displayType: 'text', optional: true },
      { name: 'outputData', dbType: 'object', displayType: 'text', optional: true },
      { name: 'resultEvent', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'ok', value: 'ok' }, { label: 'error', value: 'error' }, { label: 'true', value: 'true' }, { label: 'false', value: 'false' }] } },
      { name: 'errorMessage', dbType: 'string', displayType: 'text', optional: true },
      { name: 'startedAt', dbType: 'datetime', displayType: 'date', optional: true },
      { name: 'completedAt', dbType: 'datetime', displayType: 'date', optional: true },
    ],
    relations: [
      { kind: 'reference', fromColumn: 'instanceId', toTable: 'workflow_instances', toColumn: 'id', type: 'many-to-many', fromTable: 'workflow_actions' },
      { kind: 'reference', fromColumn: 'designId', toTable: 'workflow_designs', toColumn: 'id', type: 'many-to-many', fromTable: 'workflow_actions' },
    ],
  },
]

/** Tenant-level table schemas, provisioned inside each company namespace. */
export const TENANT_TABLE_SCHEMAS: TableSchemaDefinition[] = [
  {
    name: 'members',
    label: 'Members',
    resourceType: 'member',
    columns: [
      { name: 'profileId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨members:profileId:user_profiles:id⟩' } },
      { name: 'email', dbType: 'string', displayType: 'email', optional: true },
      { name: 'role', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'owner', value: 'owner' }, { label: 'admin', value: 'admin' }, { label: 'member', value: 'member' }] } },
      { name: 'status', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'pending', value: 'pending' }, { label: 'active', value: 'active' }, { label: 'inactive', value: 'inactive' }] } },
      { name: 'inviteCode', dbType: 'string', displayType: 'text', optional: true, unique: true },
      { name: 'joinedAt', dbType: 'datetime', displayType: 'date', optional: true },
      { name: 'invitedBy', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨members:invitedBy:members:id⟩' } },
    ],
    relations: [
      { kind: 'reference', fromColumn: 'profileId', toTable: 'user_profiles', toColumn: 'id', type: 'many-to-many', fromTable: 'members' },
      { kind: 'reference', fromColumn: 'invitedBy', toTable: 'members', toColumn: 'id', type: 'one-to-many', fromTable: 'members' },
    ],
  },
  {
    name: 'sessions',
    label: 'Sessions',
    columns: [
      { name: 'platformSessionId', dbType: 'string', displayType: 'text', optional: true },
      { name: 'memberId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨sessions:memberId:members:id⟩' } },
      { name: 'profileId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨sessions:profileId:user_profiles:id⟩' } },
      { name: 'email', dbType: 'string', displayType: 'text', optional: true },
      { name: 'companyId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨sessions:companyId:companies:id⟩' } },
      { name: 'type', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'user', value: 'user' }, { label: 'impersonation', value: 'impersonation' }] } },
      { name: 'impersonatorId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨sessions:impersonatorId:members:id⟩' } },
      { name: 'deviceFingerprint', dbType: 'string', displayType: 'text', optional: true },
      { name: 'deviceName', dbType: 'string', displayType: 'text', optional: true },
      { name: 'ip', dbType: 'string', displayType: 'text', optional: true },
      { name: 'userAgent', dbType: 'string', displayType: 'text', optional: true },
      { name: 'lastUsedAt', dbType: 'datetime', displayType: 'date', optional: true },
      { name: 'revokedAt', dbType: 'datetime', displayType: 'date', optional: true },
      { name: 'revokeReason', dbType: 'string', displayType: 'text', optional: true },
    ],
    relations: [
      { kind: 'reference', fromColumn: 'memberId', toTable: 'members', toColumn: 'id', type: 'many-to-many', fromTable: 'sessions' },
      { kind: 'reference', fromColumn: 'profileId', toTable: 'user_profiles', toColumn: 'id', type: 'many-to-many', fromTable: 'sessions' },
      { kind: 'reference', fromColumn: 'companyId', toTable: 'companies', toColumn: 'id', type: 'many-to-many', fromTable: 'sessions' },
      { kind: 'reference', fromColumn: 'impersonatorId', toTable: 'members', toColumn: 'id', type: 'many-to-many', fromTable: 'sessions' },
    ],
  },
  {
    name: 'workflow_designs',
    label: 'Workflow Designs',
    resourceType: 'workflow_design',
    columns: [
      { name: 'name', dbType: 'string', displayType: 'text', optional: true },
      { name: 'xstateConfig', dbType: 'object', displayType: 'json', optional: true },
      { name: 'starts', dbType: 'array', displayType: 'json', optional: true, fields: [
        { name: 'type', dbType: 'string', displayType: 'select', optional: true, config: { options: [{ label: 'db_trigger', value: 'db_trigger' }, { label: 'user_trigger', value: 'user_trigger' }, { label: 'cron', value: 'cron' }, { label: 'webhook', value: 'webhook' }] } },
        { name: 'startState', dbType: 'string', displayType: 'text', optional: true },
        { name: 'options', dbType: 'object', displayType: 'json', optional: true },
      ] },
    ],
    relations: undefined,
  },
  {
    name: 'workflow_instances',
    label: 'Workflow Instances',
    columns: [
      { name: 'designId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨workflow_instances:designId:workflow_designs:id⟩' } },
      { name: 'status', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'pending', value: 'pending' }, { label: 'running', value: 'running' }, { label: 'waiting', value: 'waiting' }, { label: 'done', value: 'done' }, { label: 'error', value: 'error' }] } },
      { name: 'currentState', dbType: 'string', displayType: 'text', optional: true },
      { name: 'context', dbType: 'object', displayType: 'json', optional: true },
      { name: 'triggerBy', dbType: 'object', displayType: 'json', optional: true, fields: [
        { name: 'type', dbType: 'string', displayType: 'select', optional: true, config: { options: [{ label: 'db_trigger', value: 'db_trigger' }, { label: 'user_trigger', value: 'user_trigger' }, { label: 'cron', value: 'cron' }, { label: 'webhook', value: 'webhook' }] } },
        { name: 'startState', dbType: 'string', displayType: 'text', optional: true },
      ] },
      { name: 'namespace', dbType: 'string', displayType: 'text', optional: true },
      { name: 'companyId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨workflow_instances:companyId:companies:id⟩' } },
    ],
    relations: [
      { kind: 'reference', fromColumn: 'designId', toTable: 'workflow_designs', toColumn: 'id', type: 'many-to-many', fromTable: 'workflow_instances' },
      { kind: 'reference', fromColumn: 'companyId', toTable: 'companies', toColumn: 'id', type: 'many-to-many', fromTable: 'workflow_instances' },
    ],
  },
  {
    name: 'user_tasks',
    label: 'User Tasks',
    columns: [
      { name: 'instanceId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨user_tasks:instanceId:workflow_instances:id⟩' } },
      { name: 'type', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'approval', value: 'approval' }, { label: 'review', value: 'review' }, { label: 'manual', value: 'manual' }] } },
      { name: 'status', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'pending', value: 'pending' }, { label: 'completed', value: 'completed' }, { label: 'cancelled', value: 'cancelled' }, { label: 'rejected', value: 'rejected' }] } },
      { name: 'tableName', dbType: 'string', displayType: 'text', optional: true },
      { name: 'recordId', dbType: 'record', displayType: 'text', optional: true },
      { name: 'designId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨user_tasks:designId:workflow_designs:id⟩' } },
      { name: 'resolvedAt', dbType: 'datetime', displayType: 'date', optional: true },
    ],
    relations: [
      { kind: 'reference', fromColumn: 'instanceId', toTable: 'workflow_instances', toColumn: 'id', type: 'many-to-many', fromTable: 'user_tasks' },
      { kind: 'reference', fromColumn: 'designId', toTable: 'workflow_designs', toColumn: 'id', type: 'many-to-many', fromTable: 'user_tasks' },
    ],
  },
  {
    name: 'workflow_actions',
    label: 'Workflow Actions',
    columns: [
      { name: 'instanceId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨workflow_actions:instanceId:workflow_instances:id⟩' } },
      { name: 'designId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨workflow_actions:designId:workflow_designs:id⟩' } },
      { name: 'stateId', dbType: 'string', displayType: 'text', optional: true },
      { name: 'action', dbType: 'string', displayType: 'text', optional: true },
      { name: 'params', dbType: 'object', displayType: 'text', optional: true },
      { name: 'status', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'started', value: 'started' }, { label: 'completed', value: 'completed' }, { label: 'failed', value: 'failed' }] } },
      { name: 'inputContext', dbType: 'object', displayType: 'text', optional: true },
      { name: 'outputContext', dbType: 'object', displayType: 'text', optional: true },
      { name: 'outputData', dbType: 'object', displayType: 'text', optional: true },
      { name: 'resultEvent', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'ok', value: 'ok' }, { label: 'error', value: 'error' }, { label: 'true', value: 'true' }, { label: 'false', value: 'false' }] } },
      { name: 'errorMessage', dbType: 'string', displayType: 'text', optional: true },
      { name: 'startedAt', dbType: 'datetime', displayType: 'date', optional: true },
      { name: 'completedAt', dbType: 'datetime', displayType: 'date', optional: true },
    ],
    relations: [
      { kind: 'reference', fromColumn: 'instanceId', toTable: 'workflow_instances', toColumn: 'id', type: 'many-to-many', fromTable: 'workflow_actions' },
      { kind: 'reference', fromColumn: 'designId', toTable: 'workflow_designs', toColumn: 'id', type: 'many-to-many', fromTable: 'workflow_actions' },
    ],
  },
  {
    name: 'permission_groups',
    label: 'Permission Groups',
    columns: [
      { name: 'resourceType', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: ['admin_user', 'admin_user_detail', 'admin_user_group', 'admin_user_group_detail', 'company', 'company_member', 'member', 'platform', 'tenant', 'user_group', 'user_group_detail', 'workflow_design', 'workflow_design_detail'].map((r) => ({ label: r, value: r })) } },
      { name: 'recordId', dbType: 'string', displayType: 'text', optional: true },
      { name: 'name', dbType: 'string', displayType: 'text', optional: true },
      { name: 'isSystem', dbType: 'boolean', displayType: 'checkbox', optional: true },
      { name: 'description', dbType: 'string', displayType: 'text', optional: true },
    ],
    relations: undefined,
  },
  {
    name: 'resource_types',
    label: 'Resource Types',
    columns: [
      { name: 'name', dbType: 'string', displayType: 'text', optional: true },
      { name: 'table', dbType: 'string', displayType: 'text', optional: true },
      { name: 'hasRecordId', dbType: 'boolean', displayType: 'checkbox', optional: true },
      { name: 'bitMapping', dbType: 'array', displayType: 'json', optional: true },
      { name: 'defaultGroups', dbType: 'array', displayType: 'json', optional: true },
      { name: 'parentResourceType', dbType: 'string', displayType: 'text', optional: true },
      { name: 'isSystem', dbType: 'boolean', displayType: 'checkbox', optional: true },
      { name: 'scope', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'Platform', value: 'platform' }, { label: 'Tenant', value: 'tenant' }] } },
    ],
    relations: undefined,
  },
  {
    name: 'user_groups',
    label: 'User Groups',
    resourceType: 'user_group',
    columns: [
      { name: 'name', dbType: 'string', displayType: 'text', optional: true },
      { name: 'description', dbType: 'string', displayType: 'text', optional: true },
    ],
    relations: undefined,
  },
  {
    name: '_views',
    label: 'Views',
    columns: [
      { name: 'table', dbType: 'string', displayType: 'text', optional: true },
      { name: 'type', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'table', value: 'table' }] } },
      { name: 'name', dbType: 'string', displayType: 'text', optional: true },
      { name: 'description', dbType: 'string', displayType: 'text', optional: true },
      { name: 'isDefault', dbType: 'boolean', displayType: 'checkbox', optional: true, defaultValue: false },
      { name: 'config', dbType: 'object', displayType: 'json', optional: true },
      { name: 'group', dbType: 'object', displayType: 'json', optional: true },
      { name: 'filter', dbType: 'object', displayType: 'json', optional: true },
      { name: 'sort', dbType: 'array', displayType: 'json', optional: true },
    ],
    relations: undefined,
  },
  {
    name: 'company_policies',
    label: 'Company Policies',
    columns: [
      { name: 'companyId', dbType: 'record', displayType: 'relation', optional: true, config: { relationId: '_relations:⟨company_policies:companyId:companies:id⟩' } },
      { name: 'maxSessions', dbType: 'number', displayType: 'number', optional: true },
      { name: 'sessionOverflowAction', dbType: 'string', displayType: 'select', optional: true, config: { displayType: 'select', options: [{ label: 'revoke_oldest', value: 'revoke_oldest' }, { label: 'reject', value: 'reject' }] } },
      { name: 'allowImpersonation', dbType: 'boolean', displayType: 'checkbox', optional: true },
      { name: 'allowApiKeys', dbType: 'boolean', displayType: 'checkbox', optional: true },
    ],
    relations: [
      { kind: 'reference', fromColumn: 'companyId', toTable: 'companies', toColumn: 'id', type: 'many-to-many', fromTable: 'company_policies' },
    ],
  },
]

export const GRAPH_RELATIONS: RelationDefinition[] = [
  {
    kind: 'graph',
    name: 'groups',
    fromTable: 'platform_users',
    toTable: 'admin_user_groups',
    linkTable: 'admin_user_group_memberships',
    type: 'many-to-many',
  },
  {
    kind: 'graph',
    name: 'members',
    fromTable: 'user_groups',
    toTable: 'members',
    linkTable: 'user_group_memberships',
    type: 'many-to-many',
  },
  {
    kind: 'graph',
    name: 'permissions',
    fromTable: 'permission_groups',
    toTable: 'resources',
    linkTable: 'permission_apply_to',
    type: 'many-to-many',
  },
  {
    kind: 'graph',
    name: 'parents',
    fromTable: 'resources',
    toTable: 'resources',
    linkTable: 'resource_parent',
    type: 'many-to-many',
  },
  {
    kind: 'graph',
    name: 'assignments',
    fromTable: 'members',
    toTable: 'permission_groups',
    linkTable: 'permission_assignments',
    type: 'many-to-many',
  },
]
export interface TableInput {
  name: string
  label?: string
  description?: string
  hidden?: boolean
}

export interface ColumnInput {
  table: string
  name: string
  label?: string
  dbType: ColumnDefinition['dbType']
  displayType: ColumnDefinition['displayType']
  config?: Record<string, unknown>
  fields?: ColumnDefinition[]
  system?: boolean
  unique?: boolean
  uniqueScope?: string
  optional?: boolean
  defaultValue?: unknown
  hidden?: boolean
  order?: number
}

export interface RelationInput {
  kind: 'reference' | 'graph'
  name?: string
  fromTable: string
  fromColumn?: string
  toTable: string
  toColumn?: string
  type?: 'one-to-one' | 'one-to-many' | 'many-to-many'
  linkTable?: string
}

export interface SyncResult {
  tableName: string
  columnsDiscovered: number
}

export interface ViewInput extends Omit<Partial<ViewDefinition>, 'group' | 'filter'> {
  group?: unknown
  filter?: unknown
}

export interface ViewRow extends Omit<ViewDefinition, 'group' | 'filter'> {
  id: string
  createdAt?: string
  updatedAt?: string
  group?: unknown
  filter?: unknown
}

const SYSTEM_COLUMN_NAMES = SYSTEM_COLUMNS.map((c) => c.name)

export function isValidIdentifier(value: string): boolean {
  return /^[a-z_][a-z0-9_]*$/i.test(value)
}

async function ensureRegistryTables(surreal: Surreal) {
  await surreal.query(`
    DEFINE TABLE IF NOT EXISTS _tables SCHEMALESS;
    DEFINE TABLE IF NOT EXISTS _columns SCHEMALESS;
    DEFINE TABLE IF NOT EXISTS _relations SCHEMALESS;
    DEFINE TABLE IF NOT EXISTS _views SCHEMALESS;
    DEFINE INDEX IF NOT EXISTS idx_tables_name ON _tables FIELDS name UNIQUE;
    DEFINE INDEX IF NOT EXISTS idx_columns_table ON _columns FIELDS table;
    DEFINE INDEX IF NOT EXISTS idx_columns_table_name ON _columns FIELDS table, name UNIQUE;
    DEFINE INDEX IF NOT EXISTS idx_relations_from ON _relations FIELDS fromTable, fromColumn;
    DEFINE INDEX IF NOT EXISTS idx_relations_to ON _relations FIELDS toTable, toColumn;
    DEFINE INDEX IF NOT EXISTS idx_relations_unique ON _relations FIELDS fromTable, fromColumn, toTable, toColumn UNIQUE;
    DEFINE INDEX IF NOT EXISTS idx_views_table ON _views FIELDS table;
    DEFINE INDEX IF NOT EXISTS idx_views_table_name ON _views FIELDS table, name UNIQUE;
    DEFINE INDEX IF NOT EXISTS idx_views_default ON _views FIELDS table, isDefault;
  `)
}

async function releaseConnection(surreal: Surreal, shared: boolean): Promise<void> {
  if (!shared) {
    await closeSurreal(surreal)
  }
}

export async function listTables(namespace: string, database: string, surreal?: Surreal) {
  const managed = surreal ?? (await getSurreal(namespace, database))
  try {
    await ensureRegistryTables(managed)
    const [rows] = (await managed.query('SELECT * FROM _tables ORDER BY name')) as [TableRow[]]
    return rows ?? []
  } finally {
    await releaseConnection(managed, !!surreal)
  }
}

export async function listUserTables(namespace: string, database: string, surreal?: Surreal) {
  const all = await listTables(namespace, database, surreal)
  return all.filter((t) => !t.name.startsWith('_'))
}

export async function upsertTable(
  namespace: string,
  database: string,
  input: TableInput,
  surreal?: Surreal
) {
  if (!isValidIdentifier(input.name)) {
    throw new Error(`Invalid table name: ${input.name}`)
  }
  const managed = surreal ?? (await getSurreal(namespace, database))
  try {
    await ensureRegistryTables(managed)
    const id = `_tables:⟨${input.name}⟩`
    const now = new Date().toISOString()
    await managed.query(
      `
      UPSERT ${id} SET
        name = $name,
        label = $label,
        description = $description,
        hidden = $hidden,
        updatedAt = $now,
        createdAt = IF missing THEN $now ELSE createdAt END
      `,
      { ...input, now }
    )
    return { id }
  } finally {
    await releaseConnection(managed, !!surreal)
  }
}

function validateColumnFields(fields: ColumnDefinition[] | undefined, path: string[] = []): void {
  if (!fields || fields.length === 0) return

  const seen = new Set<string>()

  for (const field of fields) {
    const fieldPath = [...path, field.name]
    const pathStr = fieldPath.join('.')

    if (!isValidIdentifier(field.name)) {
      throw new Error(`Invalid nested field name: ${pathStr}`)
    }
    if (seen.has(field.name)) {
      throw new Error(`Duplicate nested field name: ${pathStr}`)
    }
    seen.add(field.name)

    if (field.system === true) {
      throw new Error(`Nested field cannot be a system column: ${pathStr}`)
    }
    if (field.unique === true) {
      throw new Error(`Nested field cannot be unique: ${pathStr}`)
    }
    if (field.uniqueScope !== undefined) {
      throw new Error(`Nested field cannot have a uniqueScope: ${pathStr}`)
    }
    if (field.order !== undefined) {
      throw new Error(`Nested field cannot have an order: ${pathStr}`)
    }

    if (field.fields && field.fields.length > 0) {
      if (field.dbType !== 'object' && field.dbType !== 'array') {
        throw new Error(`Nested fields are only allowed on object or array columns, found '${field.dbType}' at ${pathStr}`)
      }
      validateColumnFields(field.fields, fieldPath)
    }
  }
}

export async function upsertColumn(
  namespace: string,
  database: string,
  input: ColumnInput,
  surreal?: Surreal
) {
  if (!isValidIdentifier(input.table)) {
    throw new Error(`Invalid table name: ${input.table}`)
  }
  if (!isValidIdentifier(input.name)) {
    throw new Error(`Invalid column name: ${input.name}`)
  }
  if (SYSTEM_COLUMN_NAMES.includes(input.name) && input.system !== true) {
    throw new Error(`Cannot upsert system column ${input.name} without system: true`)
  }
  if (input.system === true && input.fields !== undefined) {
    throw new Error(`System column ${input.name} cannot have nested fields`)
  }
  if (input.fields !== undefined && input.fields.length > 0 && input.dbType !== 'object' && input.dbType !== 'array') {
    throw new Error(`Nested fields are only allowed on object or array columns`)
  }
  if (input.system === true) {
    const canonical = SYSTEM_COLUMNS.find((c) => c.name === input.name)
    if (!canonical) {
      throw new Error(`Unknown system column: ${input.name}`)
    }
    if (
      input.dbType !== canonical.dbType ||
      input.displayType !== canonical.displayType ||
      input.optional !== canonical.optional ||
      input.hidden !== canonical.hidden
    ) {
      throw new Error(`Cannot upsert system column ${input.name} with non-canonical definition`)
    }
    if (input.config !== undefined && JSON.stringify(input.config) !== JSON.stringify(canonical.config)) {
      throw new Error(`Cannot upsert system column ${input.name} with non-canonical config`)
    }
  }
  validateColumnFields(input.fields)
  const managed = surreal ?? (await getSurreal(namespace, database))
  try {
    await ensureRegistryTables(managed)
    const id = `_columns:⟨${input.table}:${input.name}⟩`
    const now = new Date().toISOString()
    await managed.query(
      `
      UPSERT ${id} SET
        table = $table,
        name = $name,
        label = $label,
        dbType = $dbType,
        displayType = $displayType,
        config = $config,
        fields = $fields,
        system = $system,
        unique = $unique,
        uniqueScope = $uniqueScope,
        optional = $optional,
        defaultValue = $defaultValue,
        hidden = $hidden,
        order = $order,
        updatedAt = $now,
        createdAt = IF missing THEN $now ELSE createdAt END
      `,
      { ...input, config: input.config ?? {}, system: input.system ?? false, fields: input.fields ?? null, now }
    )
    return { id }
  } finally {
    await releaseConnection(managed, !!surreal)
  }
}

export async function upsertRelation(
  namespace: string,
  database: string,
  input: RelationInput,
  surreal?: Surreal
) {
  const identifiers: Array<[string, string | undefined]> = [
    ['fromTable', input.fromTable],
    ['toTable', input.toTable],
  ]
  if (input.kind === 'reference') {
    identifiers.push(['fromColumn', input.fromColumn], ['toColumn', input.toColumn])
  } else {
    identifiers.push(['linkTable', input.linkTable])
  }
  for (const [key, value] of identifiers) {
    if (!value || !isValidIdentifier(value)) {
      throw new Error(`Invalid ${key}: ${value}`)
    }
  }
  const managed = surreal ?? (await getSurreal(namespace, database))
  try {
    await ensureRegistryTables(managed)
    const name = input.name ?? input.fromColumn ?? input.linkTable
    const id =
      input.kind === 'graph'
        ? `_relations:⟨graph:${input.fromTable}:${input.linkTable}:${input.toTable}⟩`
        : `_relations:⟨${input.fromTable}:${input.fromColumn}:${input.toTable}:${input.toColumn}⟩`
    const now = new Date().toISOString()
    await managed.query(
      `
      UPSERT ${id} SET
        kind = $kind,
        name = $name,
        fromTable = $fromTable,
        fromColumn = $fromColumn,
        toTable = $toTable,
        toColumn = $toColumn,
        type = $type,
        linkTable = $linkTable,
        updatedAt = $now,
        createdAt = IF missing THEN $now ELSE createdAt END
      `,
      { ...input, name, now }
    )
    return { id }
  } finally {
    await releaseConnection(managed, !!surreal)
  }
}

export async function getTableSchema(
  namespace: string,
  database: string,
  tableName: string
): Promise<TableSchema | null> {
  if (!isValidIdentifier(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`)
  }
  const surreal = await getSurreal(namespace, database)
  try {
    await ensureRegistryTables(surreal)
    const [[table], columns, relations] = (await surreal.query(
      `
      SELECT * FROM _tables WHERE name = $tableName;
      SELECT * FROM _columns WHERE table = $tableName ORDER BY order, name;
      SELECT * FROM _relations WHERE fromTable = $tableName OR toTable = $tableName;
      `,
      { tableName }
    )) as [TableRow[], ColumnRow[], RelationRow[]]

    if (!table) {
      return null
    }

    const mergedColumns = new Map<string, ColumnRow>()
    for (const col of SYSTEM_COLUMNS) {
      mergedColumns.set(col.name, { ...col, table: tableName })
    }
    for (const col of columns ?? []) {
      mergedColumns.set(col.name, col)
    }

    return {
      table,
      columns: Array.from(mergedColumns.values()),
      relations: relations ?? [],
    }
  } finally {
    await closeSurreal(surreal)
  }
}

type InferResult = {
  dbType: ColumnDefinition['dbType']
  displayType: ColumnDefinition['displayType']
  relation?: Omit<RelationInput, 'fromTable' | 'fromColumn'>
}

function inferTypes(value: unknown): InferResult {
  if (typeof value === 'boolean') return { dbType: 'boolean', displayType: 'checkbox' }
  if (typeof value === 'number') return { dbType: 'number', displayType: 'number' }
  if (Array.isArray(value)) return { dbType: 'array', displayType: 'text' }
  if (value !== null && typeof value === 'object') return { dbType: 'object', displayType: 'text' }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return { dbType: 'datetime', displayType: 'date' }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { dbType: 'string', displayType: 'email' }
    if (/^https?:\/\//.test(value)) return { dbType: 'string', displayType: 'url' }
    const recordMatch = value.match(/^([^:]+):([^:]+)$/)
    if (recordMatch && recordMatch[1] ) {
      const toTable = recordMatch[1]
      return {
        dbType: 'record',
        displayType: 'relation',
        relation: {
          kind: 'reference',
          toTable,
          toColumn: 'id',
          type: 'many-to-many',
        },
      }
    }
    return { dbType: 'string', displayType: 'text' }
  }
  return { dbType: 'string', displayType: 'text' }
}

export async function syncTableSchemaFromRecords(
  namespace: string,
  database: string,
  tableName: string,
  sampleSize = 100
): Promise<SyncResult> {
  if (!isValidIdentifier(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`)
  }
  if (tableName.startsWith('_')) {
    throw new Error(`Cannot sync system table: ${tableName}`)
  }
  const surreal = await getSurreal(namespace, database)
  try {
    await ensureRegistryTables(surreal)
    await upsertTable(namespace, database, { name: tableName }, surreal)
    const [records] = (await surreal.query(
      `SELECT * FROM ${tableName} LIMIT $sampleSize`,
      { sampleSize }
    )) as [Record<string, unknown>[]]

    const columnMap = new Map<string, ColumnInput>()
    const upsertedRelations = new Set<string>()

    for (const record of records ?? []) {
      for (const [name, value] of Object.entries(record)) {
        if (SYSTEM_COLUMN_NAMES.includes(name)) continue
        if (!isValidIdentifier(name)) {
          throw new Error(`Invalid column name: ${name}`)
        }
        const { dbType, displayType, relation } = inferTypes(value)
        const existing = columnMap.get(name)
        if (!existing) {
          columnMap.set(name, {
            table: tableName,
            name,
            dbType,
            displayType,
            config: {},
            optional: true,
          })
        }
        if (relation && displayType === 'relation') {
          const relationId = `_relations:⟨${tableName}:${name}:${relation.toTable}:id⟩`
          if (!upsertedRelations.has(relationId)) {
            await upsertRelation(
              namespace,
              database,
              {
                ...relation,
                fromTable: tableName,
                fromColumn: name,
                type: 'many-to-many',
              },
              surreal
            )
            upsertedRelations.add(relationId)
          }
          const column = columnMap.get(name)
          if (column) {
            column.config = {
              displayType: 'relation',
              relationId,
            }
          }
        }
      }
    }

    for (const column of columnMap.values()) {
      await upsertColumn(namespace, database, column, surreal)
    }

    return { tableName, columnsDiscovered: columnMap.size }
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listViews(
  namespace: string,
  database: string,
  tableName?: string,
  surreal?: Surreal
): Promise<ViewRow[]> {
  const managed = surreal ?? (await getSurreal(namespace, database))
  try {
    await ensureRegistryTables(managed)
    const query = tableName
      ? 'SELECT * FROM _views WHERE table = $tableName ORDER BY name'
      : 'SELECT * FROM _views ORDER BY name'
    const [rows] = (await managed.query(query, tableName ? { tableName } : undefined)) as [ViewRow[]]
    return rows ?? []
  } finally {
    await releaseConnection(managed, !!surreal)
  }
}

export async function getView(
  namespace: string,
  database: string,
  viewId: string
): Promise<ViewRow | null> {
  const surreal = await getSurreal(namespace, database)
  try {
    await ensureRegistryTables(surreal)
    const [rows] = (await surreal.query(
      'SELECT * FROM type::record($viewId)',
      { viewId }
    )) as [ViewRow[]]
    return normalizeId(rows?.[0]) ?? null
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getDefaultView(
  namespace: string,
  database: string,
  tableName: string
): Promise<ViewRow | null> {
  if (!isValidIdentifier(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`)
  }
  const surreal = await getSurreal(namespace, database)
  try {
    await ensureRegistryTables(surreal)
    const [rows] = (await surreal.query(
      'SELECT * FROM _views WHERE table = $tableName AND isDefault = true LIMIT 1',
      { tableName }
    )) as [ViewRow[]]
    return rows?.[0] ?? null
  } finally {
    await closeSurreal(surreal)
  }
}

export async function generateDefaultView(
  namespace: string,
  database: string,
  tableName: string,
  resourceType?: string,
  surreal?: Surreal
): Promise<ViewRow> {
  if (!isValidIdentifier(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`)
  }
  const managed = surreal ?? (await getSurreal(namespace, database))
  const shouldRelease = !surreal
  try {
    await ensureRegistryTables(managed)
    const schema = await getTableSchema(namespace, database, tableName)
    if (!schema) {
      throw new Error(`Table not found: ${tableName}`)
    }

    const LOOKUP_FIELDS: Record<string, string | undefined> = {
      companies: 'name',
      user_profiles: 'name',
      members: 'email',
      workflow_designs: 'name',
      platform_users: 'email',
      admin_user_groups: 'name',
      permission_groups: 'name',
      resources: 'name',
      user_groups: 'name',
    }

    const RELATION_LABELS: Record<string, string | undefined> = {
      companyId: 'Company',
      profileId: 'Profile',
      memberId: 'Member',
      impersonatorId: 'Impersonator',
      invitedBy: 'Invited by',
      designId: 'Design',
      accountId: 'Account',
      platformUserId: 'Platform User',
      instanceId: 'Instance',
      groups: 'Groups',
      members: 'Members',
      assignments: 'Permission Groups',
      parents: 'Parents',
      permissions: 'Resources',
    }

    function capitalize(str: string): string {
      return str.charAt(0).toUpperCase() + str.slice(1)
    }

    const baseColumns = schema.columns
      .filter((col: ColumnRow) => !col.hidden)
      .sort((a: ColumnRow, b: ColumnRow) => (a.order ?? Infinity) - (b.order ?? Infinity))
      .map((col: ColumnRow) => ({
        column: col.name,
        label: col.label,
        width: 'auto' as const,
        visible: true,
      }))

    const columns: TableColumnConfig[] = []
    for (const col of baseColumns) {
      columns.push(col)
      const relation = schema.relations?.find((r) => r.kind === 'reference' && r.fromColumn === col.column)
      if (!relation || !relation.fromColumn) continue
      const field = LOOKUP_FIELDS[relation.toTable]
      if (!field) continue
      const prefix = RELATION_LABELS[relation.fromColumn] ?? relation.fromColumn
      columns.push({
        type: 'lookup',
        lookup: { relation: relation.fromColumn, field },
        label: `${prefix} ${field === 'email' ? 'Email' : 'Name'}`,
        width: 'auto',
        visible: true,
      })
    }

    for (const relation of schema.relations ?? []) {
      if (relation.kind !== 'graph' || !relation.name) continue
      if (relation.fromTable === tableName) {
        const field = LOOKUP_FIELDS[relation.toTable] ?? 'name'
        columns.push({
          type: 'lookup',
          lookup: { relation: relation.name, field, agg: 'list' },
          label: RELATION_LABELS[relation.name] ?? capitalize(relation.name),
          width: 'auto',
          visible: true,
        })
      }
      if (relation.toTable === tableName) {
        columns.push({
          type: 'lookup',
          lookup: { relation: relation.name, agg: 'count' },
          label: `${RELATION_LABELS[relation.name] ?? capitalize(relation.name)} Count`,
          width: 'auto',
          visible: true,
        })
      }
    }

    const data = {
      table: tableName,
      resourceType,
      type: 'table' as const,
      name: 'Default',
      description: `Default table view for ${tableName}`,
      isDefault: true,
      config: { table: { columns } },
    }

    const [existing] = (await managed.query(
      'SELECT * FROM _views WHERE table = $tableName AND isDefault = true LIMIT 1',
      { tableName }
    )) as [ViewRow[]]

    const now = new Date().toISOString()

    if (existing?.[0]) {
      const existingId = normalizeId(existing[0])!.id
      const [updated] = (await managed.query(
        'UPDATE type::record($id) MERGE $data',
        { id: existingId, data: { ...data, updatedAt: now } }
      )) as [ViewRow[]]
      return normalizeId(updated[0])!
    }

    const [created] = (await managed.query(
      'CREATE _views CONTENT $data',
      { data: { ...data, createdAt: now, updatedAt: now } }
    )) as [ViewRow[]]
    return normalizeId(created[0])!
  } finally {
    if (shouldRelease) {
      await closeSurreal(managed)
    }
  }
}

export async function upsertView(
  namespace: string,
  database: string,
  input: ViewInput,
  surreal?: Surreal
): Promise<ViewRow> {
  const managed = surreal ?? (await getSurreal(namespace, database))
  const shouldRelease = !surreal
  try {
    await ensureRegistryTables(managed)

    let merged = { ...input } as ViewInput
    if (input.id) {
      const [existing] = (await managed.query(
        'SELECT * FROM type::record($viewId)',
        { viewId: input.id }
      )) as [ViewRow[]]
      if (!existing?.[0]) {
        throw new Error(`View not found: ${input.id}`)
      }
      merged = { ...normalizeId(existing[0]), ...input }
    }

    if (!merged.table || !isValidIdentifier(merged.table)) {
      throw new Error(`Invalid table name: ${merged.table}`)
    }
    if (!merged.name || merged.name.trim().length === 0) {
      throw new Error('View name is required')
    }
    if (merged.type !== 'table') {
      throw new Error(`Unsupported view type: ${merged.type}`)
    }

    const [[tableRow]] = (await managed.query('SELECT * FROM _tables WHERE name = $tableName', {
      tableName: merged.table,
    })) as [[TableRow | undefined]]
    if (!tableRow) {
      throw new Error(`Table not found: ${merged.table}`)
    }

    const [columns, relations] = (await managed.query(
      `
      SELECT * FROM _columns WHERE table = $tableName;
      SELECT * FROM _relations WHERE fromTable = $tableName OR toTable = $tableName;
      `,
      { tableName: merged.table }
    )) as [ColumnRow[], RelationRow[]]
    const columnNames = new Set(SYSTEM_COLUMNS.map((c) => c.name))
    for (const col of columns ?? []) {
      columnNames.add(col.name)
    }
    const relationByName = new Map(
      (relations ?? []).map((r) => [r.name ?? r.fromColumn ?? r.linkTable ?? '', r])
    )

    const VALID_LOOKUP_FIELD = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/
    for (const col of merged.config?.table?.columns ?? []) {
      if (col.type === 'lookup') {
        const lookup = col.lookup
        if (!lookup) {
          throw new Error('Lookup column is missing lookup configuration')
        }
        const relationName = lookup.relation
        const relation = relationByName.get(relationName)
        if (!relation || !relationName) {
          throw new Error(`Lookup column references unknown relation: ${relationName}`)
        }
        if (lookup.agg !== 'count' && !lookup.field) {
          throw new Error(`Lookup column requires a field: ${relationName}`)
        }
        if (lookup.field && !VALID_LOOKUP_FIELD.test(lookup.field)) {
          throw new Error(`Invalid lookup field: ${lookup.field}`)
        }
        continue
      }
      if (!col.column || !columnNames.has(col.column)) {
        throw new Error(`Unknown column in view config: ${col.column}`)
      }
    }

    const data = {
      table: merged.table,
      resourceType: merged.resourceType ?? null,
      type: merged.type,
      name: merged.name,
      description: merged.description ?? null,
      isDefault: merged.isDefault ?? false,
      config: merged.config ?? {},
      group: merged.group ?? null,
      filter: merged.filter ?? null,
      sort: merged.sort ?? null,
    }

    if (data.isDefault) {
      await managed.query(
        'UPDATE _views SET isDefault = false WHERE table = $tableName AND isDefault = true',
        { tableName: merged.table }
      )
    }

    const now = new Date().toISOString()

    if (merged.id) {
      const [updated] = (await managed.query(
        'UPDATE type::record($id) MERGE $data',
        { id: merged.id, data: { ...data, updatedAt: now } }
      )) as [ViewRow[]]
      return normalizeId(updated[0])!
    }

    const [created] = (await managed.query(
      'CREATE _views CONTENT $data',
      { data: { ...data, createdAt: now, updatedAt: now } }
    )) as [ViewRow[]]
    return normalizeId(created[0])!
  } finally {
    if (shouldRelease) {
      await closeSurreal(managed)
    }
  }
}

export async function deleteView(
  namespace: string,
  database: string,
  viewId: string,
  surreal?: Surreal
): Promise<{ id: string }> {
  const managed = surreal ?? (await getSurreal(namespace, database))
  const shouldRelease = !surreal
  try {
    await ensureRegistryTables(managed)
    await managed.query('DELETE type::record($viewId)', { viewId })
    return { id: viewId }
  } finally {
    if (shouldRelease) {
      await closeSurreal(managed)
    }
  }
}
