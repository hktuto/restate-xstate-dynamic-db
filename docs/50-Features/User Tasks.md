---
title: User Tasks
type: feature
status: planned
area: workflow
created: 2026-06-15
updated: 2026-06-15
related:
  - [[Workflow Engine]]
  - [[Workflow Runtime]]
  - [[30-Apps/Workflow Runtime/Overview]]
  - [[40-Packages/db]]
---

# User Tasks

## Overview

User tasks represent manual work that must be completed before a workflow can continue. They replace the earlier hardcoded "approval" concept with a generic `waiting` tag so workflows can pause for approvals, reviews, or any other human step.

## When user tasks are created

The runtime creates a user task whenever an XState state has the `waiting` tag. The task type is read from the state's `meta.taskType` field and defaults to `approval`.

Supported task types:

- `approval`
- `review`
- `manual`

## Data model

Tenant namespace (`company_<uuid>/main`):

| Record | Purpose |
|--------|---------|
| `user_tasks` | Tasks created by running workflow instances. |

Platform namespace (`platform/admin`) also stores `user_tasks` for platform-level workflows.

Task statuses:

- `pending`
- `completed`
- `rejected`
- `cancelled`

## Lifecycle

1. Workflow enters a state tagged `waiting`.
2. Runtime POSTs to `/api/user-tasks` to create the task.
3. User completes or rejects the task through the web or admin UI.
4. UI PATCHes the workflow instance status or the runtime resolves the task and resumes the workflow.

## API endpoints

- `POST /api/user-tasks` — create a task (called by runtime).
- `POST /api/user-tasks/:id/approve` — mark a task as completed.
- `POST /api/user-tasks/:id/reject` — mark a task as rejected.

## Related

- [[Workflow Engine]]
- [[Workflow Runtime]]
- [[30-Apps/Workflow Runtime/Overview|Workflow Runtime App]]
- [[40-Packages/db|db package]]
