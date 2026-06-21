// packages/db/src/seed.ts
import { fileURLToPath } from 'node:url'
import { hashPassword, defaultGroups, allActionsBitmask, type ResourceType } from 'shared'
import { getSurreal, closeSurreal, closeSurrealPool } from './client.js'
import { PLATFORM_TABLE_SCHEMAS, SYSTEM_COLUMNS } from './schema-definitions.js'
import { generateDefaultView, upsertColumn, upsertRelation, upsertTable } from './schema-registry.js'
import { cleanDb } from './clean-db.js'
import { seedResourceTypes } from './resource-types.js'
import { createPermissionGroup, assignPermissionGroup, applyPermissionToResource } from './permissions.js'

export async function seed() {
  const surreal = await getSurreal()
  try {
    const passwordHash = await hashPassword('admin')
    const tableDefinitions = PLATFORM_TABLE_SCHEMAS.map((t) => `DEFINE TABLE IF NOT EXISTS ${t.name} SCHEMALESS;`).join('\n')

    await surreal.query(`
      DEFINE NAMESPACE IF NOT EXISTS platform;
      USE NS platform DB admin;
      DEFINE DATABASE IF NOT EXISTS admin;
      USE NS platform DB admin;

      ${tableDefinitions}

      DEFINE TABLE IF NOT EXISTS admin_user_group_memberships TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_admin_user_group_memberships_unique ON admin_user_group_memberships FIELDS in, out UNIQUE;

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

      DEFINE INDEX IF NOT EXISTS idx_health_checks_checkedAt ON health_checks FIELDS checkedAt;
      DEFINE INDEX IF NOT EXISTS idx_health_checks_service_checkedAt ON health_checks FIELDS service, checkedAt;
      DEFINE INDEX IF NOT EXISTS idx_companies_slug ON companies FIELDS slug UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_accounts_provider_key ON accounts FIELDS provider, providerKey UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_platform_sessions_refreshTokenHash ON sessions FIELDS refreshTokenHash UNIQUE;

      DEFINE TABLE IF NOT EXISTS resource_types SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_resource_types_name ON resource_types FIELDS name UNIQUE;

      DEFINE TABLE IF NOT EXISTS resource_parent TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_resource_parent_in ON resource_parent FIELDS in;
      DEFINE INDEX IF NOT EXISTS idx_resource_parent_out ON resource_parent FIELDS out;

      DEFINE TABLE IF NOT EXISTS permission_apply_to TYPE RELATION SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_permission_apply_to_out_in ON permission_apply_to FIELDS out, in;
      DEFINE INDEX IF NOT EXISTS idx_permission_apply_to_recordId ON permission_apply_to FIELDS recordId;

      UPSERT platform_users:admin SET email = 'admin@example.com', password = $password;
      UPSERT admin_user_groups:superadmin SET name = 'Super Admin', description = 'Full platform access';
      DELETE admin_user_group_memberships WHERE in = type::record('platform_users:admin') AND out = type::record('admin_user_groups:superadmin');
      RELATE platform_users:admin->admin_user_group_memberships->admin_user_groups:superadmin;
    `, { password: passwordHash })

    for (const table of PLATFORM_TABLE_SCHEMAS) {
      await upsertTable('platform', 'admin', { name: table.name, label: table.label })
      for (const column of table.columns) {
        await upsertColumn('platform', 'admin', { ...column, table: table.name })
      }
      for (const column of SYSTEM_COLUMNS) {
        await upsertColumn('platform', 'admin', { ...column, table: table.name })
      }
      for (const relation of table.relations ?? []) {
        await upsertRelation('platform', 'admin', relation)
      }
    }

    for (const table of PLATFORM_TABLE_SCHEMAS) {
      await generateDefaultView('platform', 'admin', table.name)
    }

    await seedResourceTypes('platform', 'admin', 'platform')
    await seedPlatformDefaultGroups()

    console.log('Platform namespace seeded')
  } finally {
    await closeSurreal(surreal)
  }
}

async function seedPlatformDefaultGroups(): Promise<void> {
  const platformOwnerGroup = await createPermissionGroup('platform', 'admin', {
    resourceType: 'platform',
    name: 'owner',
    isSystem: true,
    description: 'Full platform access',
  })
  const platformOwnerBitmask = Number(allActionsBitmask('platform'))

  await applyPermissionToResource('platform', 'admin', {
    groupId: platformOwnerGroup.id,
    resourceType: 'platform',
    bitmask: platformOwnerBitmask,
    propagateMask: platformOwnerBitmask,
  })
  await assignPermissionGroup('platform', 'admin', 'platform_users:admin', platformOwnerGroup.id)

  const resourceNames: ResourceType[] = ['admin_user', 'admin_user_group', 'company', 'company_member', 'workflow_design']
  for (const resourceName of resourceNames) {
    const groups = defaultGroups(resourceName)
    for (const groupDef of groups) {
      const group = await createPermissionGroup('platform', 'admin', {
        resourceType: resourceName,
        name: groupDef.name,
        isSystem: true,
      })
      await applyPermissionToResource('platform', 'admin', {
        groupId: group.id,
        resourceType: resourceName,
        bitmask: groupDef.bitmask,
        propagateMask: groupDef.propagateMask,
      })
      if (groupDef.name === 'owner') {
        await assignPermissionGroup('platform', 'admin', 'platform_users:admin', group.id)
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cleanDb()
    .then(() => seed())
    .then(async () => {
      await closeSurrealPool()
    })
    .catch(err => {
      console.error('Seed failed:', err)
      process.exit(1)
    })
}
