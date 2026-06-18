import { randomUUID } from 'node:crypto'
import { getSurreal, closeSurreal } from '../src/client.js'

export function assertValidNamespace(name: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid namespace name: ${name}`)
  }
}

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
      DEFINE TABLE IF NOT EXISTS health_checks SCHEMALESS;
      DEFINE INDEX IF NOT EXISTS idx_health_checks_checkedAt ON health_checks FIELDS checkedAt;
      DEFINE INDEX IF NOT EXISTS idx_health_checks_service_checkedAt ON health_checks FIELDS service, checkedAt;
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
      DELETE platform_users;
      DELETE accounts;
      DELETE user_profiles;
      DELETE workflow_designs;
      DELETE triggers;
      DELETE workflow_instances;
      DELETE user_tasks;
      DELETE health_checks;
    `)
  } finally {
    await closeSurreal(surreal)
  }
}

export function uniqueTenantName() {
  return `test_tenant_${randomUUID().replaceAll('-', '_')}`
}

export async function createTenantNamespace(namespace: string) {
  assertValidNamespace(namespace)
  const surreal = await getSurreal()
  try {
    await surreal.query(`
      DEFINE NAMESPACE IF NOT EXISTS ${namespace};
      USE NS ${namespace} DB main;
      DEFINE DATABASE IF NOT EXISTS main;
      USE NS ${namespace} DB main;
      DEFINE TABLE IF NOT EXISTS members SCHEMALESS;
      DEFINE TABLE IF NOT EXISTS workflow_designs SCHEMALESS;
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
  assertValidNamespace(namespace)
  const surreal = await getSurreal()
  try {
    await surreal.query(`REMOVE NAMESPACE IF EXISTS ${namespace};`)
  } finally {
    await closeSurreal(surreal)
  }
}
