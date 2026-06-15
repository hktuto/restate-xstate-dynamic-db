---
title: Status Board
type: index
status: in-progress
area: docs
created: 2026-06-14
updated: 2026-06-14
related:
  - [[Project Brief]]
  - [[Dashboard]]
  - [[Roadmap]]
---

# Status Board

Live view of features, runbooks, and ADRs by status.

## In progress

```dataview
TABLE status, area, app
FROM "docs"
WHERE status = "in-progress"
SORT file.name ASC
```

## Planned

```dataview
TABLE status, area, app
FROM "docs"
WHERE status = "planned"
SORT file.name ASC
```

## Done

```dataview
TABLE status, area, app
FROM "docs"
WHERE status = "done"
SORT file.name ASC
```

## Idle

```dataview
TABLE status, area, app
FROM "docs"
WHERE status = "idle"
SORT file.name ASC
```

## By app

### Web app features

```dataview
TABLE status, area
FROM "docs"
WHERE app = "web" OR contains(app, "web")
SORT status, file.name ASC
```

### Admin app features

```dataview
TABLE status, area
FROM "docs"
WHERE app = "admin" OR contains(app, "admin")
SORT status, file.name ASC
```

### Runtime features

```dataview
TABLE status, area
FROM "docs"
WHERE app = "runtime" OR contains(app, "runtime")
SORT status, file.name ASC
```
