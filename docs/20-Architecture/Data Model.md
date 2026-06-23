---
title: Data Model
type: note
status: done
area: architecture
created: 2026-06-14
updated: 2026-06-21
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
| `workflow_designs` | Workflow templates available to all tenants. Each design contains an XState config and a `starts` array of start rules (`db_trigger`, `user_trigger`, `cron`, `webhook`). |
| `workflow_instances` | Running and historical platform workflow instances. Stores `designId`, `status`, `currentState`, `context`, and `triggerBy`. |
| `workflow_actions` | Audit/state record for each action-state execution. Stored per instance, keyed by `instanceId:stateId`, with `status` (`started` / `completed` / `failed`) and timestamps. |
| `user_tasks` | Manual tasks created by platform workflow instances. |
| `health_checks` | Service health check records. |

## Tenant namespace (`company_<uuid>/main`)

| Record | Purpose |
|--------|---------|
| `workflow_designs` | Company-specific workflow designs. Each design contains an XState config and a `starts` array of start rules (`db_trigger`, `user_trigger`, `cron`, `webhook`). |
| `workflow_instances` | Running and historical workflow instances. Stores `designId`, `status`, `currentState`, `context`, and `triggerBy`. |
| `workflow_actions` | Audit/state record for each action-state execution. Stored per instance, keyed by `instanceId:stateId`, with `status` (`started` / `completed` / `failed`) and timestamps. |
| `user_tasks` | Manual tasks created by workflow instances. |
| `members` | Company membership, role, invite status. |

## Schema registry

Every namespace/database contains three system tables that describe its own schema:

- `_tables` — one row per table (name, label, hidden).
- `_columns` — one row per column (name, dbType, displayType, config, system, unique, optional, etc.).
- `_relations` — one row per relation between tables (fromTable, fromColumn, toTable, toColumn, type).

Existing platform and tenant tables (`companies`, `members`, `workflows`, etc.) are described declaratively in `packages/db/src/schema-definitions.ts`. `seed.ts` and `provision.ts` use this file to both `DEFINE TABLE` and populate `_tables`, `_columns`, and `_relations`. Every table also receives a standard set of system columns (`id`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy`) via `SYSTEM_COLUMNS`.

The table/schema API is served by `apps/api`, a dedicated Hono service. Both `apps/web` and `apps/admin` call this service instead of duplicating server routes.

## Closed-set (`select`) columns

These columns are declared as `displayType: 'select'` with a fixed option list in `packages/db/src/schema-definitions.ts`:

| Table | Column | Options |
|---|---|---|
| `companies` | `status` | `active`, `inactive` |
| `sessions` | `type` | `user`, `impersonation` |
| `accounts` | `provider` | `email`, `oauth_google`, `oauth_github`, `phone` |
| `user_profiles` | `gender` | `male`, `female`, `other`, `prefer_not_to_say` |
| `workflow_instances` | `status` | `pending`, `running`, `waiting`, `done`, `error` |
| `workflow_instances.triggerBy` | `type` | `db_trigger`, `user_trigger`, `cron`, `webhook` |
| `user_tasks` | `type` | `approval`, `review`, `manual` |
| `user_tasks` | `status` | `pending`, `completed`, `cancelled`, `rejected` |
| `workflow_actions` | `status` | `started`, `completed`, `failed` |
| `workflow_actions` | `resultEvent` | `ok`, `error`, `true`, `false` |
| `health_checks` | `service` | `surrealdb`, `restate`, `workflow-runtime`, `api` |
| `health_checks` | `status` | `healthy`, `unhealthy` |
| `resource_types` | `scope` | `platform`, `tenant` |
| `permission_groups` | `resourceType` | all catalog resource type names |
| `_views` | `type` | `table` |
| `company_policies` | `sessionOverflowAction` | `revoke_oldest`, `reject` |
| `members` | `role` | `owner`, `admin`, `member` |
| `members` | `status` | `pending`, `active`, `inactive` |

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
