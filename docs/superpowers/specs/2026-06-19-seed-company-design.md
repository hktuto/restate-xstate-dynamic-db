---
title: Seed Company Script Design
type: note
status: in-progress
area: docs
created: 2026-06-19
updated: 2026-06-20
related:
  - [[Tenant Permission System]]
  - [[Company Management]]
---

# Seed Company Script Design

## Goal

Provide a repeatable way to seed a fully populated tenant company for manual testing and automated integration tests. The script creates a company, owner, members, user groups, and permission assignments in a single command.

## Location and invocation

- **File:** `packages/db/scripts/seed-company.ts`
- **Run:** `pnpm --filter db seed-company`
- **Package script:** add `"seed-company": "tsx scripts/seed-company.ts"` to `packages/db/package.json`

## Company identity

| Field | Value |
|---|---|
| Name | `SeedCo Test` |
| Slug | `seedco-test` |
| Namespace | `company_seedco_test` |

The script uses a fixed identity so tests and manual runs have a stable URL (`/api/companies/seedco-test`) and namespace.

## People

All accounts share the password `SeedPass123!`.

| Account | Email | Member role | Company permission group | User groups |
|---|---|---|---|---|
| `owner` | `owner@seedco.test` | `owner` | Owner shortcut (all bits) | Engineering (owner), Product (owner), Finance (owner) |
| `alice` | `alice@seedco.test` | `member` | **Admin** | Engineering (owner) |
| `bob` | `bob@seedco.test` | `member` | **Admin** | Product (owner) |
| `charlie` | `charlie@seedco.test` | `member` | Member | Engineering |
| `diana` | `diana@seedco.test` | `member` | Member | Engineering |
| `evan` | `evan@seedco.test` | `member` | Member | Engineering |
| `fiona` | `fiona@seedco.test` | `member` | Member | Product |
| `george` | `george@seedco.test` | `member` | Member | Product |
| `hannah` | `hannah@seedco.test` | `member` | Member | Finance |
| `ian` | `ian@seedco.test` | `member` | Member | Finance |
| `judy` | `judy@seedco.test` | `member` | Member | — |
| `pending.pat` | `pending@seedco.test` | `member` | Member | — |
| `inactive.ira` | `inactive@seedco.test` | `member` | Member | — |

Status notes:

- `pending.pat` is created with `status: 'pending'` to test invite flows.
- `inactive.ira` is created with `status: 'inactive'` to test inactive-member guards.

## User groups

| Group | Members | Record-level owners |
|---|---|---|
| `Engineering` | charlie, diana, evan | owner, alice |
| `Product` | fiona, george | owner, bob |
| `Finance` | hannah, ian | owner |

Each group is created with `createUserGroupWithDefaults`, which automatically creates the Owner/Admin/Member record-level permission groups and assigns the creator to the Owner group.

## Permission assignments

### Company level

- **Owner shortcut** applies to `owner`.
- **Admin** group assigned to `alice` and `bob`.
- **Member** group assigned to `charlie` through `inactive.ira`.

### User-group record level

- The user group itself is assigned to its own **Member** permission group, so every member of the group inherits `user_group:view`.
- `alice` is assigned to the **Owner** group of `Engineering`.
- `bob` is assigned to the **Owner** group of `Product`.

## Idempotency

The script is destructive on repeat runs:

1. Check if a company with slug `seedco-test` exists in the platform namespace.
2. If it exists:
   - `REMOVE NAMESPACE company_seedco_test`
   - Delete the `companies:seedco-test` record
3. Create the company fresh.
4. Provision the company namespace.
5. Create accounts, profiles, members, groups, and assignments.

This guarantees a deterministic, clean state for every test run.

## Output

After seeding, the script prints:

- Company name, slug, and namespace
- A table of login emails and roles
- A table of user groups and their members
- A reminder that the default password is `SeedPass123!`

## Dependencies

Reuses existing DB helpers:

- `createCompany`, `getCompanyBySlug` from `packages/db/src/platform.ts`
- `provisionCompanyNamespace` from `packages/db/src/provision.ts`
- `createAccount`, `createUserProfile` from `packages/db/src/platform.ts`
- `createMember` from `packages/db/src/tenant.ts`
- `provisionDefaultCompanyGroups`, `assignPermissionGroup` from `packages/db/src/permissions.ts`
- `createUserGroupWithDefaults`, `addUserGroupMember` from `packages/db/src/user-groups.ts`

## Success criteria

- `pnpm --filter db seed-company` runs cleanly on a fresh or already-seeded DB.
- `pnpm --filter db typecheck` passes.
- `pnpm --filter db test` still passes.
- Smoke test: the seeded owner can log in, list members, create a user group, and invite/add a member.
