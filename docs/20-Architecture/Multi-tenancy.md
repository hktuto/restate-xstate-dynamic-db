---
title: Multi-tenancy
type: note
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Data Model]]
  - [[Authentication & Authorization]]
  - [[30-Apps/Web App/Overview]]
---

# Multi-tenancy

## Isolation model

Each company gets its own SurrealDB namespace:

```
company_<uuid-without-hyphens>/main
```

This provides strong data isolation between tenants while sharing the same SurrealDB cluster.

## Company resolution

The web app resolves the current company from:

1. `company_slug` cookie (browser requests).
2. `x-company-namespace` header (server-to-server / Restate calls).

If neither is present, page requests redirect to `/` and API requests return `404 Company not found`.

## Platform context

The superadmin app operates against the `platform/admin` namespace and has no company context.

## Related

- [[Data Model]]
- [[Authentication & Authorization]]
- [[30-Apps/Web App/Overview|Web App]]
