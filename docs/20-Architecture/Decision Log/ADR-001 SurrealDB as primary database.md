---
title: ADR-001: SurrealDB as primary database
type: adr
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Data Model]]
  - [[Multi-tenancy]]
---

# ADR-001: SurrealDB as primary database

## Context

The project needs a database that can store both platform-level and tenant-level data with flexible schemas.

## Decision

Use SurrealDB 3.x as the primary database.

## Rationale

- Multi-tenancy via namespaces is a first-class concept.
- Supports record IDs, relations, and graph queries in one engine.
- Simplifies local development with a single Docker container.

## Consequences

- Team must learn SurrealQL and namespace/database semantics.
- Operational tooling is less mature than PostgreSQL.

## Related

- [[Data Model]]
- [[Multi-tenancy]]
