---
title: Project Brief
type: index
status: in-progress
area: docs
created: 2026-06-14
updated: 2026-06-15
related:
  - [[Vision]]
  - [[System Overview]]
  - [[Status Board]]
  - [[Roadmap]]
  - [[Getting Started]]
  - [[50-Features/Company Management]]
  - [[50-Features/Tenant Authentication & Authorization]]
  - [[50-Features/Workflow Engine]]
  - [[50-Features/User Tasks]]
  - [[50-Features/Admin Health Monitor]]
  - [[Documentation Conventions]]
  - [[20-Architecture/Decision Log/ADR-001 SurrealDB as primary database]]
  - [[20-Architecture/Decision Log/ADR-002 Restate for workflow runtime]]
  - [[20-Architecture/Decision Log/ADR-003 Nuxt layers for workflow editor]]
  - [[20-Architecture/Decision Log/ADR-004 Bcrypt for password hashing]]
  - [[00-Atlas/README]]
  - [[Goals & Non-Goals]]
  - [[Technology Stack]]
  - [[Data Model]]
---

# Project Brief

Use this note to understand the project quickly without reading all documentation.

## What is this project?

`restate-xstate` is a multi-tenant SaaS proof-of-concept that lets teams design XState workflows visually and run them durably on Restate.

## Why it exists

Building durable, long-running workflows is hard. This project combines a visual editor, a shared action/guard catalog, and Restate to make workflow authoring and execution reliable.

## Current phase

Phase 1 — Foundation is **done**. Phase 2 — Workflow Designer is **planned**.
See [[Roadmap]] and [[Status Board]] for details.

## Current active work

- [[50-Features/Company Management|Company Management]] — `done`
- [[50-Features/Tenant Authentication & Authorization|Tenant Authentication & Authorization]] — `done`.
- [[50-Features/Workflow Engine|Workflow Engine]] — `done`
- [[50-Features/User Tasks|User Tasks]] — `done`
- [[Documentation Conventions]] — `in-progress`

## Key architecture decisions

- [[20-Architecture/Decision Log/ADR-001 SurrealDB as primary database|ADR-001]] — SurrealDB as primary database.
- [[20-Architecture/Decision Log/ADR-002 Restate for workflow runtime|ADR-002]] — Restate for durable workflow runtime.
- [[20-Architecture/Decision Log/ADR-003 Nuxt layers for workflow editor|ADR-003]] — Nuxt layers for shared workflow editor.
- [[20-Architecture/Decision Log/ADR-004 Bcrypt for password hashing|ADR-004]] — bcrypt for password hashing.

## How to use this documentation

1. Start here or at [[00-Atlas/README|README]].
2. For project direction, read [[Vision]], [[Goals & Non-Goals]], and [[Roadmap]].
3. For technical context, read [[System Overview]], [[Technology Stack]], and [[Data Model]].
4. For app-specific docs, see `30-Apps/`.
5. For feature status, see [[Status Board]].
6. For operational procedures, see `70-Operations/`.

## For AI agents

If you are an AI assistant working on this codebase:

1. Read this note first, then [[System Overview]] and [[Technology Stack]].
2. Check [[Status Board]] to see what is currently planned or in progress.
3. Look up the relevant `30-Apps/` or `40-Packages/` note before changing code.
4. Follow [[Documentation Conventions]] when adding or updating docs.
5. Update `updated:` in frontmatter when you edit a note.

## How to update this documentation

See [[Documentation Conventions]].

## Project layout

```
apps/
  web/                    # Tenant Nuxt app (port 3000)
  admin/                  # Superadmin Nuxt app (port 3001)
  workflow-runtime/       # Restate service (port 9080)
  health-monitor/         # Standalone health-check service (Bun)
layers/
  workflow-editor/        # Shared editor Nuxt layer
packages/
  db/                     # SurrealDB queries
  shared/                 # Shared utilities
  workflow-actions/       # Action/guard catalog
docs/                     # This Obsidian vault
```

## Quick commands

```bash
pnpm install
pnpm -r build
docker compose up -d
pnpm --filter db seed
# Infrastructure + health monitor
docker compose up -d

# Apps
pnpm --filter admin dev
pnpm --filter web dev
pnpm --filter workflow-runtime dev
```
