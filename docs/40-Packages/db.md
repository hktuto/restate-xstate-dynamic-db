---
title: db package
type: package
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-15
package: db
related:
  - [[Data Model]]
  - [[Multi-tenancy]]
---

# db package

## Purpose

SurrealDB connection, queries, and seeding for platform and tenant namespaces.

## Location

`packages/db`

## Key modules

- `src/platform.ts` — platform-level queries (companies, platform users, platform workflows).
- `src/seed.ts` — seeds `platform/admin` namespace with default admin user.

## Key helpers

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
