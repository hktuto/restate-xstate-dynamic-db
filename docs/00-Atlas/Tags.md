---
title: Tags
type: note
status: done
area: docs
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Documentation Conventions]]
  - [[How to use this vault]]
---

# Tags

Controlled vocabulary for the vault. These values live in frontmatter (`status`, `area`, `type`) and can also be used as inline tags.

## Status values

Use in frontmatter `status:`:

- `idle` — Not currently planned.
- `planned` — Scheduled for upcoming work.
- `in-progress` — Actively being worked on.
- `done` — Completed and current.

Legacy tags: `#status/active`, `#status/planned`, `#status/idea`, `#status/done`, `#status/blocker`, `#status/deprecated`.

## Area values

Use in frontmatter `area:`:

- `architecture`
- `web`
- `admin`
- `runtime`
- `db`
- `workflow`
- `ops`
- `docs`

Legacy tags: `#area/architecture`, `#area/web`, `#area/admin`, `#area/runtime`, `#area/db`, `#area/workflow`, `#area/ops`, `#area/docs`.

## Type values

Use in frontmatter `type:`:

- `adr` — Architecture Decision Record.
- `feature` — Feature specification.
- `runbook` — Operational procedure.
- `note` — General note.
- `template` — Obsidian template.
- `meeting` — Meeting notes.

Legacy tags: `#type/adr`, `#type/feature`, `#type/runbook`, `#type/note`, `#type/template`.

## Priority tags

- `#priority/high`
- `#priority/medium`
- `#priority/low`
