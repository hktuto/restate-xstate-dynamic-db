---
title: workflow-actions package
type: package
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-14
package: workflow-actions
related:
  - [[50-Features/Workflow Actions Catalog]]
  - [[50-Features/Guards & Conditions]]
---

# workflow-actions package

## Purpose

Catalog of reusable workflow actions and guards, plus runtime execution helpers.

## Location

`packages/workflow-actions`

## Structure

- `src/catalog/` — definitions of available actions and guards.
- `src/runtime/` — runtime execution logic.

## Adding an action or guard

1. Add the catalog definition in `src/catalog/`.
2. Add the runtime implementation in `src/runtime/`.
3. Register it in the catalog index.

## Related

- [[50-Features/Workflow Actions Catalog|Workflow Actions Catalog]]
- [[50-Features/Guards & Conditions|Guards & Conditions]]
