import { getSurreal, closeSurreal } from '../src/client.js'

export async function ensurePlatformNamespace() {
  const surreal = await getSurreal()
  try {
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
      DEFINE INDEX IF NOT EXISTS idx_companies_slug ON companies FIELDS slug UNIQUE;
      DEFINE INDEX IF NOT EXISTS idx_accounts_provider_key ON accounts FIELDS provider, providerKey UNIQUE;
    `)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function resetPlatformTables() {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query(`
      DELETE companies;
      DELETE accounts;
      DELETE user_profiles;
      DELETE workflows;
      DELETE triggers;
      DELETE workflow_instances;
      DELETE user_tasks;
    `)
  } finally {
    await closeSurreal(surreal)
  }
}

export function uniqueTenantName() {
  return `test_tenant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function createTenantNamespace(namespace: string) {
  const surreal = await getSurreal()
  try {
    await surreal.query(`
      DEFINE NAMESPACE IF NOT EXISTS ${namespace};
      USE NS ${namespace} DB main;
      DEFINE DATABASE IF NOT EXISTS main;
      USE NS ${namespace} DB main;
      DEFINE TABLE IF NOT EXISTS members SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS workflows SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS triggers SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS workflow_instances SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS user_tasks SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_members_profileId ON members FIELDS profileId;
      DEFINE INDEX IF NOT EXISTS idx_members_inviteCode ON members FIELDS inviteCode UNIQUE;
    `)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function removeTenantNamespace(namespace: string) {
  const surreal = await getSurreal()
  try {
    await surreal.query(`REMOVE NAMESPACE IF EXISTS ${namespace};`)
  } finally {
    await closeSurreal(surreal)
  }
}
