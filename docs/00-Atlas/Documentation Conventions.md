---
title: Documentation Conventions
type: note
status: in-progress
area: docs
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Project Brief]]
  - [[Status Board]]
  - [[How to use this vault]]
  - [[Tags]]
  - [[System Overview]]
  - [[...]]
---

# Documentation Conventions

This note defines how every document in this vault must be structured so that humans and AI can understand the project without reading everything.

## Every note must have frontmatter

All Markdown files in this vault start with YAML frontmatter:

```yaml
---
title: "Exact note title"
type: note
status: planned
area: workflow
app:
  - web
  - admin
created: 2026-06-14
updated: 2026-06-14
---
```

### Common properties

| Property | Required | Values |
|----------|----------|--------|
| `title` | yes | Exact title of the note. |
| `type` | yes | `note`, `adr`, `feature`, `runbook`, `app`, `package`, `project`, `template`, `index`. |
| `status` | yes for features, runbooks, ADRs | `idle`, `planned`, `in-progress`, `done`. |
| `area` | yes | `architecture`, `web`, `admin`, `runtime`, `db`, `workflow`, `ops`, `docs`. |
| `app` | for features and app notes | One or more of `web`, `admin`, `runtime`. |
| `package` | for package notes | `db`, `shared`, `workflow-actions`, `workflow-editor-layer`. |
| `related` | recommended | List of wikilinks as strings, e.g. `"[[System Overview]]"`. |
| `owner` | optional | Person or team responsible. |
| `created` | yes | ISO date (`YYYY-MM-DD`). |
| `updated` | yes | ISO date (`YYYY-MM-DD`). |

### Status values (use exactly)

- `idle` — Not currently planned.
- `planned` — Scheduled for upcoming work.
- `in-progress` — Actively being worked on.
- `done` — Completed and current.

## How to create or update a note

1. Pick the right folder under `docs/`.
2. Copy the matching template from `90-Templates/`.
3. Fill in all required frontmatter.
4. Write a short summary in the first paragraph.
5. Link to related notes in `related:` frontmatter and inline with `[[...]]`.
6. Update the `updated:` date when you edit.
7. If a feature status changes, update the feature note. The [[Status Board]] will reflect it automatically if you use Dataview.

## Special notes

- `00-Atlas/Project Brief.md` — AI-first summary of the whole project. Update it when scope changes.
- `00-Atlas/Status Board.md` — Live view of all features and ADRs by status.
- `00-Atlas/Dashboard.md` — Human-curated active work and blockers.

## Tag policy

Tags are secondary to frontmatter. Use tags only for quick classification, not for status tracking.

## Migration script

If conventions change, run:

```bash
node docs/scripts/apply-frontmatter.cjs --force
```

This script skips `90-Templates/` so template placeholders are preserved.

## Related

- [[Project Brief]]
- [[Status Board]]
- [[How to use this vault]]
- [[Tags]]
