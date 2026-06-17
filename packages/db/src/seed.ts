import { hashPassword } from 'shared'
import { getSurreal, closeSurreal } from './client.js'

async function seed() {
  const surreal = await getSurreal()
  try {
    const passwordHash = await hashPassword('admin')
    await surreal.query(`
      DEFINE NAMESPACE IF NOT EXISTS platform;
      USE NS platform DB admin;
      DEFINE DATABASE IF NOT EXISTS admin;
      USE NS platform DB admin;
      DEFINE TABLE IF NOT EXISTS companies SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS platform_users SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS accounts SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS user_profiles SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS workflows SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS triggers SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS workflow_instances SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS user_tasks SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS workflow_actions SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS health_checks SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_health_checks_checkedAt ON health_checks FIELDS checkedAt;
      DEFINE INDEX IF NOT EXISTS idx_health_checks_service_checkedAt ON health_checks FIELDS service, checkedAt;
      DEFINE INDEX IF NOT EXISTS idx_companies_slug ON companies FIELDS slug UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_accounts_provider_key ON accounts FIELDS provider, providerKey UNIQUE;

      UPSERT platform_users:admin SET email = 'admin@example.com', password = $password;
    `, { password: passwordHash })
    console.log('Platform namespace seeded')
  } finally {
    await closeSurreal(surreal)
  }
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
