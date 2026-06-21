// packages/db/src/provision.ts
import { getSurreal, closeSurreal } from './client.js'
import { TENANT_TABLE_SCHEMAS, SYSTEM_COLUMNS } from './schema-definitions.js'
import { generateDefaultView, upsertColumn, upsertRelation, upsertTable } from './schema-registry.js'
import { seedResourceTypes } from './resource-types.js'

export async function provisionCompanyNamespace(namespace: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(namespace)) {
    throw new Error(`Invalid namespace name: ${namespace}. Namespace must match /^[a-z_][a-z0-9_]*$/`)
  }
  const surreal = await getSurreal()
  try {
    const tableDefinitions = TENANT_TABLE_SCHEMAS.map((t) => `DEFINE TABLE IF NOT EXISTS ${t.name} SCHEMALESS;`).join('\n')

    await surreal.query(`
      DEFINE NAMESPACE IF NOT EXISTS ${namespace};
      USE NS ${namespace} DB main;
      DEFINE DATABASE IF NOT EXISTS main;
      USE NS ${namespace} DB main;

      ${tableDefinitions}

      DEFINE TABLE IF NOT EXISTS _tables SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_tables_name ON _tables FIELDS name UNIQUE;

      DEFINE TABLE IF NOT EXISTS _columns SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_columns_table ON _columns FIELDS table;
      DEFINE INDEX IF NOT EXISTS idx_columns_table_name ON _columns FIELDS table, name UNIQUE;

      DEFINE TABLE IF NOT EXISTS _relations SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_relations_from ON _relations FIELDS fromTable, fromColumn;
      DEFINE INDEX IF NOT EXISTS idx_relations_to ON _relations FIELDS toTable, toColumn;
      DEFINE INDEX IF NOT EXISTS idx_relations_unique ON _relations FIELDS fromTable, fromColumn, toTable, toColumn UNIQUE;

      DEFINE TABLE IF NOT EXISTS _views SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_views_table ON _views FIELDS table;
      DEFINE INDEX IF NOT EXISTS idx_views_table_name ON _views FIELDS table, name UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_views_default ON _views FIELDS table, isDefault;

      DEFINE INDEX IF NOT EXISTS idx_members_profileId ON members FIELDS profileId;
      DEFINE INDEX IF NOT EXISTS idx_members_inviteCode ON members FIELDS inviteCode UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_platform_sessions_refreshTokenHash ON sessions FIELDS refreshTokenHash UNIQUE;

      DEFINE TABLE IF NOT EXISTS user_group_memberships TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_user_group_memberships_in ON user_group_memberships FIELDS in;
      DEFINE INDEX IF NOT EXISTS idx_user_group_memberships_out ON user_group_memberships FIELDS out;
      DEFINE INDEX IF NOT EXISTS idx_user_group_memberships_unique ON user_group_memberships FIELDS in, out UNIQUE;

      DEFINE TABLE IF NOT EXISTS permission_assignments TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_permission_assignments_in ON permission_assignments FIELDS in;
      DEFINE INDEX IF NOT EXISTS idx_permission_assignments_out ON permission_assignments FIELDS out;
      DEFINE INDEX IF NOT EXISTS idx_permission_assignments_resource ON permission_assignments FIELDS resourceType, recordId;
      DEFINE INDEX IF NOT EXISTS idx_permission_assignments_unique ON permission_assignments FIELDS in, resourceType, recordId UNIQUE;

      DEFINE TABLE IF NOT EXISTS resource_types SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_resource_types_name ON resource_types FIELDS name UNIQUE;

      DEFINE TABLE IF NOT EXISTS resource_parent TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_resource_parent_in ON resource_parent FIELDS in;
      DEFINE INDEX IF NOT EXISTS idx_resource_parent_out ON resource_parent FIELDS out;

      DEFINE TABLE IF NOT EXISTS permission_apply_to TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_permission_apply_to_out_in ON permission_apply_to FIELDS out, in;
      DEFINE INDEX IF NOT EXISTS idx_permission_apply_to_recordId ON permission_apply_to FIELDS recordId;
    `)

    for (const table of TENANT_TABLE_SCHEMAS) {
      await upsertTable(namespace, 'main', { name: table.name, label: table.label })
      for (const column of table.columns) {
        await upsertColumn(namespace, 'main', { ...column, table: table.name })
      }
      for (const column of SYSTEM_COLUMNS) {
        await upsertColumn(namespace, 'main', { ...column, table: table.name })
      }
      for (const relation of table.relations ?? []) {
        await upsertRelation(namespace, 'main', relation)
      }
    }

    for (const table of TENANT_TABLE_SCHEMAS) {
      await generateDefaultView(namespace, 'main', table.name)
    }

    await seedResourceTypes(namespace, 'main', 'tenant')

    return { ok: true, namespace }
  } finally {
    await closeSurreal(surreal)
  }
}
