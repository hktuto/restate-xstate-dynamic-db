---
title: Monorepo Layout
type: note
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-15
related:
  - [[System Overview]]
  - [[Technology Stack]]
---

# Monorepo Layout

```
restate-xstate/
├── apps/
│   ├── admin/                 # Superadmin Nuxt app (port 3001)
│   ├── web/                   # Tenant Nuxt app (port 3000)
│   ├── workflow-runtime/      # Restate service (port 9080)
│   └── health-monitor/        # Standalone health-check service (Bun)
├── layers/
│   └── workflow-editor/       # Shared Nuxt layer for the editor
├── packages/
│   ├── db/                    # SurrealDB queries
│   ├── shared/                # Shared utilities
│   └── workflow-actions/      # Action/guard catalog
└── docs/                      # This Obsidian vault
```

## Dependency direction

- Apps depend on `packages/*` and `layers/*`.
- `packages/db` may depend on `packages/shared`.
- `layers/workflow-editor` depends on `packages/workflow-actions` and `packages/db`.
- No circular dependencies between packages.

## Related

- [[System Overview]]
- [[Technology Stack]]
