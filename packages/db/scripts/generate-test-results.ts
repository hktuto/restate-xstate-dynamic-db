import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  ensurePlatformNamespace,
  resetPlatformTables,
  createTenantNamespace,
  removeTenantNamespace,
  uniqueTenantName,
} from '../test/helpers.js'
import * as client from '../src/client.js'
import * as provision from '../src/provision.js'
import * as platform from '../src/platform.js'
import * as tenant from '../src/tenant.js'
import * as health from '../src/health-checks.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface ResultRow {
  group: string
  fn: string
  input: unknown
  output: unknown
  error?: string
}

const results: ResultRow[] = []

async function record<T>(
  group: string,
  fn: string,
  input: unknown,
  call: () => Promise<T>,
): Promise<T | undefined> {
  try {
    const output = await call()
    results.push({ group, fn, input, output })
    return output
  } catch (err) {
    results.push({ group, fn, input, output: null, error: String(err) })
    return undefined
  }
}

function generateMarkdown(rows: ResultRow[]): string {
  const header = `---
title: DB Test Results
type: note
status: done
area: docs
created: 2026-06-16
updated: 2026-06-16
related:
  - [[Testing]]
  - [[DB Package]]
---

# DB Test Results

This note shows example inputs and the actual SurrealDB return values for the public helpers in \`packages/db\`. It was generated automatically by \`packages/db/scripts/generate-test-results.ts\`.

> **Note:** Record IDs are normalized to strings before returning to callers.

`

  const groups = Array.from(new Set(rows.map((r) => r.group)))
  const body = groups
    .map((group) => {
      const groupRows = rows.filter((r) => r.group === group)
      const table = [
        `## ${group}`,
        '',
        '| Function | Input | Output / Error |',
        '|----------|-------|----------------|',
        ...groupRows.map((r) => {
          const input = '`' + JSON.stringify(r.input).slice(0, 200) + '`'
          const cell = r.error
            ? `**ERROR:** ${r.error.replace(/\|/g, '\\|')}`
            : '`' + JSON.stringify(r.output).slice(0, 400) + '`'
          return `| \`${r.fn}\` | ${input} | ${cell} |`
        }),
      ].join('\n')
      return table
    })
    .join('\n\n')

  return header + body + '\n'
}

async function main() {
  await ensurePlatformNamespace()
  await resetPlatformTables()

  // client
  const surreal = await record('client', 'getSurreal()', {}, () => client.getSurreal())
  if (surreal) await client.closeSurreal(surreal)

  // provision
  const ns = uniqueTenantName()
  await record('provision', 'provisionCompanyNamespace', ns, () =>
    provision.provisionCompanyNamespace(ns),
  )

  // platform
  const company = await record(
    'platform',
    'createCompany',
    { name: 'Acme', slug: 'acme', namespace: 'acme' },
    () => platform.createCompany({ name: 'Acme', slug: 'acme', namespace: 'acme' }),
  )
  await record('platform', 'listCompanies', {}, () => platform.listCompanies())
  await record('platform', 'getCompanyBySlug', 'acme', () => platform.getCompanyBySlug('acme'))

  const profile = await record(
    'platform',
    'createUserProfile',
    { name: 'Alice' },
    () => platform.createUserProfile({ name: 'Alice' }),
  )
  if (profile) {
    await record('platform', 'getUserProfileById', profile.id, () =>
      platform.getUserProfileById(profile.id),
    )
  }

  const pWorkflow = await record(
    'platform',
    'createPlatformWorkflow',
    { name: 'Onboarding', xstateConfig: { id: 'onboarding', initial: 'idle', states: { idle: {} } } },
    () =>
      platform.createPlatformWorkflow({
        name: 'Onboarding',
        xstateConfig: { id: 'onboarding', initial: 'idle', states: { idle: {} } },
      }),
  )
  if (pWorkflow) {
    await record('platform', 'getPlatformWorkflow', pWorkflow.id, () =>
      platform.getPlatformWorkflow(pWorkflow.id),
    )
  }
  await record('platform', 'listPlatformWorkflows', {}, () => platform.listPlatformWorkflows())

  const pTrigger = await record(
    'platform',
    'createPlatformTrigger',
    { workflowId: pWorkflow?.id, tableName: 'orders', event: 'created' },
    () =>
      platform.createPlatformTrigger({
        workflowId: pWorkflow!.id,
        tableName: 'orders',
        event: 'created',
      }),
  )
  if (pTrigger) {
    await record('platform', 'listPlatformTriggers', {}, () => platform.listPlatformTriggers())
  }

  const pInstance = await record(
    'platform',
    'createPlatformWorkflowInstance',
    { workflowId: pWorkflow?.id, status: 'running', tableName: 'orders', recordId: 'orders:1' },
    () =>
      platform.createPlatformWorkflowInstance({
        workflowId: pWorkflow!.id,
        status: 'running',
        tableName: 'orders',
        recordId: 'orders:1',
        namespace: 'platform'
      }),
  )
  if (pInstance) {
    await record('platform', 'getPlatformWorkflowInstance', pInstance.id, () =>
      platform.getPlatformWorkflowInstance(pInstance.id),
    )
  }

  const pTask = await record(
    'platform',
    'createPlatformUserTask',
    { instanceId: pInstance?.id, type: 'approval', tableName: 'orders', recordId: 'orders:1', workflowId: pWorkflow?.id },
    () =>
      platform.createPlatformUserTask({
        instanceId: pInstance!.id,
        type: 'approval',
        tableName: 'orders',
        recordId: 'orders:1',
        workflowId: pWorkflow!.id,
      }),
  )
  if (pTask) {
    await record('platform', 'getPlatformUserTaskById', pTask.id, () =>
      platform.getPlatformUserTaskById(pTask.id),
    )
  }

  // tenant
  await createTenantNamespace(ns)

  const member = await record(
    'tenant',
    'createMember',
    { namespace: ns, email: 'admin@example.com', role: 'admin' },
    () => tenant.createMember(ns, { email: 'admin@example.com', role: 'admin' }),
  )
  if (member) {
    await record('tenant', 'getMemberById', { namespace: ns, id: member.id }, () =>
      tenant.getMemberById(ns, member.id),
    )
  }
  await record('tenant', 'listMembers', ns, () => tenant.listMembers(ns))

  const tWorkflow = await record(
    'tenant',
    'createWorkflow',
    { namespace: ns, name: 'Approval', xstateConfig: { id: 'approval', initial: 'idle', states: { idle: {} } } },
    () =>
      tenant.createWorkflow(ns, {
        name: 'Approval',
        xstateConfig: { id: 'approval', initial: 'idle', states: { idle: {} } },
      }),
  )
  if (tWorkflow) {
    await record('tenant', 'getWorkflow', { namespace: ns, id: tWorkflow.id }, () =>
      tenant.getWorkflow(ns, tWorkflow.id),
    )
  }
  await record('tenant', 'listWorkflows', ns, () => tenant.listWorkflows(ns))

  const tTrigger = await record(
    'tenant',
    'createTrigger',
    { namespace: ns, workflowId: tWorkflow?.id, tableName: 'orders', event: 'created' },
    () =>
      tenant.createTrigger(ns, {
        workflowId: tWorkflow!.id,
        tableName: 'orders',
        event: 'created',
      }),
  )
  if (tTrigger) {
    await record('tenant', 'listTriggers', ns, () => tenant.listTriggers(ns))
  }

  const tInstance = await record(
    'tenant',
    'createWorkflowInstance',
    { namespace: ns, workflowId: tWorkflow?.id, status: 'running', tableName: 'orders', recordId: 'orders:1' },
    () =>
      tenant.createWorkflowInstance(ns, {
        workflowId: tWorkflow!.id,
        status: 'running',
        tableName: 'orders',
        recordId: 'orders:1',
        namespace: ns
      }),
  )
  if (tInstance) {
    await record('tenant', 'getWorkflowInstance', { namespace: ns, id: tInstance.id }, () =>
      tenant.getWorkflowInstance(ns, tInstance.id),
    )
  }

  const tTask = await record(
    'tenant',
    'createUserTask',
    { namespace: ns, instanceId: tInstance?.id, type: 'approval', tableName: 'orders', recordId: 'orders:1', workflowId: tWorkflow?.id },
    () =>
      tenant.createUserTask(ns, {
        instanceId: tInstance!.id,
        type: 'approval',
        tableName: 'orders',
        recordId: 'orders:1',
        workflowId: tWorkflow!.id,
      }),
  )
  if (tTask) {
    await record('tenant', 'getUserTaskById', { namespace: ns, id: tTask.id }, () =>
      tenant.getUserTaskById(ns, tTask.id),
    )
  }

  // health-checks
  const hc = await record(
    'health-checks',
    'createHealthCheck',
    { service: 'api', status: 'healthy', responseTimeMs: 42 },
    () =>
      health.createHealthCheck({
        service: 'api',
        status: 'healthy',
        responseTimeMs: 42,
        checkedAt: new Date().toISOString(),
      }),
  )
  await record('health-checks', 'listLatestHealthChecks', {}, () => health.listLatestHealthChecks())
  await record('health-checks', 'listHealthCheckHistory', 10, () => health.listHealthCheckHistory(10))

  // cleanup
  await removeTenantNamespace(ns)

  const md = generateMarkdown(results)
  const outPath = resolve(__dirname, '..', '..', '..', 'docs', '60-Development', 'DB Test Results.md')
  writeFileSync(outPath, md)
  console.log(`Wrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
