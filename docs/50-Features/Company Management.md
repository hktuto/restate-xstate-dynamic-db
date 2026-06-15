---
title: Company Management
type: feature
status: done
area: admin
created: 2026-06-14
updated: 2026-06-14
app:
  - admin
related:
  - [[Data Model]]
  - [[Multi-tenancy]]
  - [[30-Apps/Admin App/Overview]]
---

# Company Management

## Overview

Create and manage tenant companies from the superadmin app.

## Company fields

- `id` — SurrealDB record ID.
- `name` — Display name.
- `slug` — URL-friendly identifier.
- `namespace` — SurrealDB namespace for tenant data.

## Behaviors

- Creating a company provisions a new SurrealDB namespace.
- The web app resolves the company by slug cookie.
- The runtime resolves the company by namespace header.

## Related

- [[Data Model]]
- [[Multi-tenancy]]
- [[30-Apps/Admin App/Overview|Admin App]]
