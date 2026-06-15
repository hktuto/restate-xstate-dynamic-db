---
title: System Overview
type: note
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
related:
  - [[30-Apps/Web App/Overview]]
  - [[30-Apps/Admin App/Overview]]
  - [[30-Apps/Workflow Runtime/Overview]]
  - [[40-Packages/db]]
  - [[40-Packages/shared]]
  - [[40-Packages/workflow-actions]]
  - [[40-Packages/workflow-editor-layer]]
  - [[Technology Stack]]
  - [[Data Model]]
  - [[Multi-tenancy]]
---

# System Overview

## Diagram (text)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web App       │     │   Admin App     │     │  Workflow       │
│   (tenant)      │     │   (superadmin)  │     │  Runtime        │
│   port 3000     │     │   port 3001     │     │  port 9080      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │       SurrealDB         │
                    │    platform + tenants   │
                    │       port 8000         │
                    └─────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │        Restate          │
                    │    port 8080 / 9070     │
                    └─────────────────────────┘
```

## Components

- [[30-Apps/Web App/Overview|Web App]] — Tenant-facing Nuxt app.
- [[30-Apps/Admin App/Overview|Admin App]] — Superadmin Nuxt app.
- [[30-Apps/Workflow Runtime/Overview|Workflow Runtime]] — Restate service.
- [[40-Packages/db|db]] — SurrealDB queries and connection.
- [[40-Packages/shared|shared]] — Shared utilities (auth, helpers).
- [[40-Packages/workflow-actions|workflow-actions]] — Action and guard catalog.
- [[40-Packages/workflow-editor-layer|workflow-editor-layer]] — Shared visual editor layer.

## Data flow

1. Admin creates a company and platform workflow templates.
2. Tenant user logs into the web app and selects a company.
3. Tenant user designs or edits a workflow in the visual editor.
4. Workflow runtime executes instances triggered by events.
5. Runtime reads/writes tenant data through the `db` package.

## Related

- [[Technology Stack]]
- [[Data Model]]
- [[Multi-tenancy]]
