---
title: db package
type: package
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-21
package: db
related:
  - [[Data Model]]
  - [[Multi-tenancy]]
  - [[Testing]]
  - [[Benchmarking]]
  - [[SurrealDB Performance Benchmark]]
  - [[Dynamic Table Schema Registry — Backend Implementation Plan]]
  - [[20-Architecture/Decision Log/ADR-005 compound-bitmask-permissions]]
  - [[Tenant Permission System]]
---

# db package

## Purpose

SurrealDB connection, queries, and seeding for platform and tenant namespaces.

## Location

`packages/db`

## Key modules

- `src/platform.ts` — platform-level queries (companies, platform users, platform workflows, identities).
- `src/provision.ts` — provisions a new tenant namespace (`DEFINE NAMESPACE`, `DEFINE DATABASE`, tables, indexes) and seeds the schema registry (`_tables`, `_columns`, `_relations`, `_views`) from the declarative schemas in `schema-definitions.ts`. Also generates a default table view for every tenant table.
- `src/seed.ts` — seeds `platform/admin` namespace with default admin user and platform schema registry.
- `src/clean-db.ts` — removes every namespace from the SurrealDB instance and drains the connection pool.

### Permission resolver

- `src/resource-types.ts` — upserts `resource_types` records from the shared catalog and builds `resource_parent` edges.
- `src/permission-resolver.ts` — resolves effective permissions by traversing `permission_assignments` and `permission_apply_to` graph edges, including ancestor propagation. Uses compound-bit checks: `(effectiveMask & actionValue) === actionValue`.
- `src/permissions.ts` — permission group CRUD, assignment, and default group provisioning.

## Scripts

```bash
# Remove every namespace (platform + all tenants)
pnpm --filter db clean-db

# Recreate a fresh platform namespace/admin user
pnpm --filter db seed        # runs clean-db first

# Seed a demo company; ensures platform tables exist first
pnpm --filter db seed-company

# Run tests against the isolated test SurrealDB instance (port 8001)
docker compose up -d surrealdb-test
pnpm --filter db test
```

`seed` starts from a clean database so that repeated runs produce the same state. `seed-company` first runs the platform seed to guarantee the `companies`, `accounts`, `user_profiles`, and related tables exist before creating the demo tenant.

## Build

`db` is imported directly as TypeScript source. Consumers resolve specific subpaths exported in `package.json` (e.g., `db`, `db/client`, `db/workflow-actions`). There is no build step.

```bash
pnpm --filter db typecheck
```

## Testing

See [[Testing]] for how to run the DB test suite.

## Benchmarking

See [[Benchmarking]] for how to run the SurrealDB performance benchmark.

## Key helpers

### Connection

- `src/client.ts`
  - `getSurreal(namespace?, database?)` — acquire a SurrealDB connection from an internal keyed pool (key = `namespace--database`). Creates a new connection if the pool has no idle match and is under the max size; otherwise it kicks out the oldest idle connection and creates one for the requested namespace/database.
  - `closeSurreal(surreal)` — release the connection back to the pool.
  - `closeSurrealPool()` — close all pooled connections (use on app shutdown).
  - `configurePool({ max?, idleTimeoutMs?, acquireTimeoutMs? })` — override pool limits at runtime.
  - Exported via `db/client`.

Pool behavior is controlled by environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SURREALDB_POOL_MAX` | `20` | Maximum open connections across all namespaces. |
| `SURREALDB_POOL_IDLE_TIMEOUT_MS` | `30000` | How long an idle connection can stay in the pool. |
| `SURREALDB_POOL_ACQUIRE_TIMEOUT_MS` | `10000` | How long to wait for a free connection before throwing. |

### Health checks

- `src/health-checks.ts` — types and persistence helpers for service health checks.
  - `HealthCheckService`, `HealthCheckStatus`
  - `createHealthCheck(...)`, `listLatestHealthChecks()`, `listHealthCheckHistory(limit)`, `pruneHealthChecks(service, keep)`

### Companies

- `listCompanies()`
- `getCompanyBySlug(slug)`
- `getCompanyByNamespace(namespace)`
- `createCompany(...)`

### Workflow designs

- `listWorkflowDesigns(namespace)` / `listPlatformWorkflowDesigns()`
- `getWorkflowDesign(namespace, id)` / `getPlatformWorkflowDesign(id)`
- `createWorkflowDesign(namespace, ...)` / `createPlatformWorkflowDesign(...)`
- `updateWorkflowDesign(namespace, id, ...)` / `updatePlatformWorkflowDesign(id, ...)`
- `deleteWorkflowDesign(namespace, id)` / `deletePlatformWorkflowDesign(id)`

Workflow designs store the XState config and an array of `StartRule` objects (`starts`). Each start rule has `type` (`db_trigger`, `user_trigger`, `cron`, `webhook`), `startState`, and `options`.

### Workflow instances

- `listWorkflowInstances(namespace)` / `listPlatformWorkflowInstances()`
- `createWorkflowInstance(namespace, ...)` / `createPlatformWorkflowInstance(...)`
- `updateWorkflowInstanceStatus(namespace, id, status)` / `updatePlatformWorkflowInstanceStatus(id, status)`

Instances reference a `workflow_designs` record via `designId`, store the current XState state in `currentState`, the actor context in `context`, and the triggering rule summary in `triggerBy`.

### Workflow actions

- `db/workflow-actions` — helpers for the `workflow_actions` audit table (`upsertWorkflowAction`, `listWorkflowActionsByInstance`).

### Views

- `src/schema-registry.ts`
  - `listViews(namespace, database, tableName?)`
  - `getView(namespace, database, viewId)`
  - `getDefaultView(namespace, database, tableName)`
  - `upsertView(namespace, database, input)`
  - `deleteView(namespace, database, viewId)`
  - `generateDefaultView(namespace, database, tableName)`

Views are stored in the `_views` system table and referenced by auto-generated Surreal record IDs. The registry enforces table existence, valid column references, and a single default view per table.

### User tasks

- `listUserTasks(namespace)` / `listPlatformUserTasks()`
- `createUserTask(namespace, ...)` / `createPlatformUserTask(...)`
- `updateUserTaskStatus(namespace, id, status)`

## Related

- [[Data Model]]
- [[Multi-tenancy]]
