// packages/db/src/seed.ts
import { fileURLToPath } from 'node:url'
import { hashPassword } from 'shared'
import { getSurreal, closeSurreal, closeSurrealPool } from './client.js'
import { PLATFORM_TABLE_SCHEMAS, SYSTEM_COLUMNS } from './schema-definitions.js'
import { upsertColumn, upsertRelation, upsertTable } from './schema-registry.js'

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

      DEFINE TABLE IF NOT EXISTS _tables SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_tables_name ON _tables FIELDS name UNIQUE;

      DEFINE TABLE IF NOT EXISTS _columns SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_columns_table ON _columns FIELDS table;
      DEFINE INDEX IF NOT EXISTS idx_columns_table_name ON _columns FIELDS table, name UNIQUE;

      DEFINE TABLE IF NOT EXISTS _relations SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_relations_from ON _relations FIELDS fromTable, fromColumn;
      DEFINE INDEX IF NOT EXISTS idx_relations_to ON _relations FIELDS toTable, toColumn;
      DEFINE INDEX IF NOT EXISTS idx_relations_unique ON _relations FIELDS fromTable, fromColumn, toTable, toColumn UNIQUE;

      DEFINE INDEX IF NOT EXISTS idx_health_checks_checkedAt ON health_checks FIELDS checkedAt;
      DEFINE INDEX IF NOT EXISTS idx_health_checks_service_checkedAt ON health_checks FIELDS service, checkedAt;
      DEFINE INDEX IF NOT EXISTS idx_companies_slug ON companies FIELDS slug UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_accounts_provider_key ON accounts FIELDS provider, providerKey UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_company_policies_companyId ON company_policies FIELDS companyId UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_platform_sessions_refreshTokenHash ON sessions FIELDS refreshTokenHash UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_sessions_refreshTokenHash ON sessions FIELDS refreshTokenHash UNIQUE;

      UPSERT platform_users:admin SET email = 'admin@example.com', password = $password;
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

    console.log('Platform namespace seeded')
  } finally {
    await closeSurreal(surreal)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(async () => {
      await closeSurrealPool()
    })
    .catch(err => {
      console.error('Seed failed:', err)
      process.exit(1)
    })
}
