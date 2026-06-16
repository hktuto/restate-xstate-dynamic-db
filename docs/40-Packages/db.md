---
title: db package
type: package
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-16
package: db
related:
  - [[Data Model]]
  - [[Multi-tenancy]]
  - [[Testing]]
---

# db package

## Purpose

SurrealDB connection, queries, and seeding for platform and tenant namespaces.

## Location

`packages/db`

## Key modules

- `src/platform.ts` — platform-level queries (companies, platform users, platform workflows).
- `src/seed.ts` — seeds `platform/admin` namespace with default admin user.

## Build

`db` is imported directly as TypeScript source. Consumers resolve `packages/db/src/*.ts` via the package `exports` field. There is no build step.

```bash
pnpm --filter db typecheck
```

## Testing

See [[Testing]] for how to run the DB test suite.

## Key helpers

### Connection

- `src/client.ts`
  - `getSurreal(namespace?, database?)` — create and sign in to a SurrealDB connection.
  - `closeSurreal(surreal)` — close a connection.
  - Exported via `db/client`.

### Health checks

- `src/health-checks.ts` — types and persistence helpers for service health checks.
  - `HealthCheckService`, `HealthCheckStatus`
  - `createHealthCheck(...)`, `listLatestHealthChecks()`, `listHealthCheckHistory(limit)`, `pruneHealthChecks(service, keep)`

### Companies

- `listCompanies()`
- `getCompanyBySlug(slug)`
- `getCompanyByNamespace(namespace)`
- `createCompany(...)`

### Workflows and triggers

- `listWorkflows(namespace)` / `listPlatformWorkflows()`
- `createWorkflow(namespace, ...)` / `createPlatformWorkflow(...)`
- `listTriggers(namespace)` / `listPlatformTriggers()`

### Workflow instances

- `listWorkflowInstances(namespace)` / `listPlatformWorkflowInstances()`
- `findActiveWorkflowInstance(namespace, workflowId, tableName, recordId)`
- `createWorkflowInstance(namespace, ...)` / `createPlatformWorkflowInstance(...)`
- `updateWorkflowInstanceStatus(namespace, id, status)`

### User tasks

- `listUserTasks(namespace)` / `listPlatformUserTasks()`
- `createUserTask(namespace, ...)` / `createPlatformUserTask(...)`
- `updateUserTaskStatus(namespace, id, status)`

## Related

- [[Data Model]]
- [[Multi-tenancy]]
