---
title: How to use this vault
type: note
status: done
area: docs
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Documentation Conventions]]
  - [[Project Brief]]
  - [[Status Board]]
  - [[90-Templates/ADR Template]]
  - [[90-Templates/Feature Note Template]]
  - [[90-Templates/Runbook Template]]
  - [[90-Templates/Bug Report Template]]
  - [[System Overview]]
  - [[Page Name]]
---

# How to use this vault

This folder is an Obsidian vault. Open `D:/work/restate-xstate/docs` as a vault to get full graph view, templates, and wikilinks.

## Start here for AI or new team members

- [[Project Brief]] — One-page project summary, current phase, and key decisions.
- [[Documentation Conventions]] — Frontmatter schema and how to update docs.
- [[Status Board]] — Live view of features, runbooks, and ADRs by status.

## Conventions

### Frontmatter (required)

Every note must start with YAML frontmatter. See [[Documentation Conventions]] for the full schema.

```yaml
---
title: "Exact note title"
type: note
status: planned
area: workflow
app:
  - web
  - admin
related:
  - "[[System Overview]]"
created: 2026-06-14
updated: 2026-06-14
---
```

### Wikilinks

Link related notes with double brackets: `[[Page Name]]`. Use aliases for readability: `[[Page Name|display text]]`.

### Tags

Tags are secondary to frontmatter. Use them sparingly for quick classification, not for status tracking.

### Templates

Use Obsidian templates from `90-Templates/`. Each template includes the correct frontmatter.

### Daily notes

Enable the Daily Notes core plugin to keep a lightweight dev journal in `80-Notes/Daily Notes/`.

### Graph view

The vault graph becomes useful once you link notes. Prefer links over tags for relationships; use tags for classification.

## Adding a new note

1. Decide the area folder (`10-Project`, `20-Architecture`, etc.).
2. Copy the appropriate template from `90-Templates/`.
3. Fill in all required frontmatter.
4. Link it from at least one MOC or index note.
5. Update [[Status Board]] if the note is a feature, runbook, or ADR.
