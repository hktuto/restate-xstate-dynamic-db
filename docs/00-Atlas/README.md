---
title: Restate XState Docs
type: index
status: done
area: docs
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Dashboard]]
  - [[How to use this vault]]
  - [[Vision]]
  - [[Getting Started]]
  - [[20-Architecture/System Overview]]
  - [[30-Apps/Web App/Overview]]
  - [[40-Packages/db]]
  - [[50-Features/Workflow Engine]]
  - [[60-Development/Getting Started]]
  - [[70-Operations/Docker Compose]]
  - [[Technology Stack]]
  - [[Data Model]]
  - [[Authentication & Authorization]]
  - [[Multi-tenancy]]
  - [[Roadmap]]
  - [[Glossary]]
  - [[Status Board]]
---

# Restate XState Docs

Welcome to the `restate-xstate` documentation vault. This Obsidian vault is the single source of truth for project context, architecture decisions, feature specs, runbooks, and development notes.

## Start here

- [[Dashboard]] — Current status, active work, and blockers.
- [[How to use this vault]] — Conventions, tags, and templates.
- [[Vision]] — Why this project exists and what it aims to solve.
- [[Getting Started]] — Set up the project locally.

## Maps of Content

### By area

- [[20-Architecture/System Overview|Architecture]]
- [[30-Apps/Web App/Overview|Apps]]
- [[40-Packages/db|Packages]]
- [[50-Features/Workflow Engine|Features]]
- [[60-Development/Getting Started|Development]]
- [[70-Operations/Docker Compose|Operations]]

### By status

See [[Status Board]] for a live view by status, or use this Dataview query:

```dataview
TABLE status, area, app
FROM "docs"
WHERE status
SORT status, file.name ASC
```

## Quick links

- [[Technology Stack]]
- [[Data Model]]
- [[Authentication & Authorization]]
- [[Multi-tenancy]]
- [[Roadmap]]
- [[Glossary]]

---

_Last updated: 2026-06-14_
