---
title: Data Model
type: note
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-17
related:
  - [[Multi-tenancy]]
  - [[50-Features/Tenant Authentication & Authorization]]
  - [[40-Packages/db]]
---

# Data Model

## Platform namespace (`platform/admin`)

| Record | Purpose |
|--------|---------|
| `platform_users` | Superadmin accounts. |
| `companies` | Tenant companies with slug and namespace. |
| `workflows` | Workflow templates available to all tenants. |
| `triggers` | Platform trigger configurations. |
| `workflow_instances` | Running and historical platform workflow instances. |
| `workflow_actions` | Audit/state record for each action-state execution. Stored per instance, keyed by `instanceId:stateId`, with `status` (`started` / `completed` / `failed`) and timestamps. |
| `user_tasks` | Manual tasks created by platform workflow instances. |
| `health_checks` | Service health check records. |

## Tenant namespace (`company_<uuid>/main`)

| Record | Purpose |
|--------|---------|
| `workflows` | Company-specific workflow definitions. |
| `triggers` | Trigger configurations. |
| `workflow_instances` | Running and historical workflow instances. |
| `workflow_actions` | Audit/state record for each action-state execution. Stored per instance, keyed by `instanceId:stateId`, with `status` (`started` / `completed` / `failed`) and timestamps. |
| `user_tasks` | Manual tasks created by workflow instances. |
| `triggers` | Trigger configurations. |
| `members` | Company membership, role, invite status. |

## Workflow instance statuses

- `pending`
- `running`
- `waiting`
- `done`
- `error`

## User task statuses

- `pending`
- `completed`
- `rejected`
- `cancelled`

## Global identity records

| Record | Purpose |
|--------|---------|
| `accounts` | Authentication credentials (provider, provider key, credential hash). |
| `user_profiles` | User name, gender, birthday, and preferences. |

A single `user_profile` can be linked to multiple company `member` records, enabling cross-company membership.

## Company namespace format

A company's namespace is derived from its UUID with hyphens removed:

```
company_<uuid-without-hyphens>/main
```

Example: `company_550e8400e29b41d4a716446655440000/main`

## Related

- [[Multi-tenancy]]
- [[50-Features/Tenant Authentication & Authorization|Tenant Authentication & Authorization]]
- [[40-Packages/db|db package]]
