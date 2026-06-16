import { getSurreal, closeSurreal } from './client.js'

export async function provisionCompanyNamespace(namespace: string) {
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
    return { ok: true, namespace }
  } finally {
    await closeSurreal(surreal)
  }
}
