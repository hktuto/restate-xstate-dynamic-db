---
title: Company Management
type: feature
status: done
area: admin
created: 2026-06-14
updated: 2026-06-16
app:
  - admin
related:
  - [[Data Model]]
  - [[Multi-tenancy]]
  - [[Tenant Authentication & Authorization]]
  - [[30-Apps/Web App/Overview]]
---

# Company Management

## Overview

Tenant companies are created from the web app by authenticated users. Each company gets its own SurrealDB namespace and an `owner` member for the creator.

## Company fields

- `id` — SurrealDB record ID.
- `name` — Display name.
- `slug` — URL-friendly identifier; auto-generated from the name and deduplicated.
- `namespace` — SurrealDB namespace for tenant data (`company_<uuid>`).

## Behaviors

- **Public creation** — any authenticated web user can create a company at `/companies/new`.
- **Ownership** — the creator receives an `owner` member record in the new namespace.
- **Provisioning** — company creation dispatches the `companies.create` trigger for provisioning (e.g., default workflows, schema setup).
- **Selection** — the active company is stored in the `company` cookie and resolved by server middleware.
- **Switching** — `CompanySwitcher` reads `/api/companies` and updates the `company` cookie.

## Removed

The admin app's company creation pages and APIs have been removed; companies are now self-service in the web app.

## Related

- [[Data Model]]
- [[Multi-tenancy]]
- [[Tenant Authentication & Authorization]]
- [[30-Apps/Web App/Overview|Web App]]
