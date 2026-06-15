---
title: Dashboard
type: index
status: in-progress
area: docs
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Project Brief]]
  - [[Status Board]]
  - [[Roadmap]]
---

# Dashboard

A human-curated live view of project status. Update this note as work progresses.

## Current Focus

- Web app company context middleware fixed; index page and `/api/companies` now load without a resolved company.
- Admin app Phase 1 complete: auth guard, login layout, logout, dashboard stats.
- Documentation system scaffolded with frontmatter and status tracking.

## Active Work (auto)

```dataview
TABLE status, area, app
FROM "docs"
WHERE status = "in-progress"
SORT file.name ASC
```

## Blockers

_None._

## Recently Completed

- [x] Admin login with bcrypt password hashing.
- [x] Global auth middleware for admin app.
- [x] Company-aware global middleware for web app.
- [x] Dashboard stats endpoint for admin app.
- [x] Documentation vault with frontmatter and status board.

## Up Next

- [ ] Flesh out workflow designer documentation.
- [ ] Document workflow action catalog registration process.
- [ ] Define trigger and guard system.

---

_Last updated: 2026-06-14_
