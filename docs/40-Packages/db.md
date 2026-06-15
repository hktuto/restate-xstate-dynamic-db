---
title: db package
type: package
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
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

- `listCompanies()`
- `getCompanyBySlug(slug)`
- `getCompanyByNamespace(namespace)`
- `createCompany(...)`
- `listPlatformWorkflows()`
- `createPlatformWorkflow(...)`

## Related

- [[Data Model]]
- [[Multi-tenancy]]
