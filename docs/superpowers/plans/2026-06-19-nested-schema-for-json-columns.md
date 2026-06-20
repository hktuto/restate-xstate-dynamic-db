---
title: Nested Schema for JSON Columns: triggerBy and starts Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-20
updated: 2026-06-20
---

# Nested Schema for JSON Columns: triggerBy and starts Implementation Plan

> **For agentic workers:** This is a simple, focused change. Inline execution is acceptable; no subagent review is required per step.

**Goal:** Annotate `workflow_instances.triggerBy` and `workflow_designs.starts` with recursive `fields` schemas in `packages/db/src/schema-definitions.ts`, and add tests asserting the shapes.

**Architecture:** Reuse the existing `column()` helper’s `extra` bag to pass `fields`. The schema registry already persists and validates nested `fields`, so no registry changes are needed.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Add nested schema to `workflow_instances.triggerBy`

**Files:**
- Modify: `packages/db/src/schema-definitions.ts:141`
- Test: `packages/db/test/schema-definitions.test.ts`

- [ ] **Step 1: Update the platform `triggerBy` column**

Replace:
```ts
  column('triggerBy', 'object', 'json'),
```
with:
```ts
  column('triggerBy', 'object', 'json', {
    fields: [
      column('type', 'string', 'select', {
        config: { options: buildOptions(['db_trigger', 'user_trigger', 'cron', 'webhook']) },
      }),
      column('startState', 'string', 'text'),
    ],
  }),
```

- [ ] **Step 2: Update the tenant `triggerBy` column**

In `packages/db/src/schema-definitions.ts:216`, make the same replacement.

- [ ] **Step 3: Add a test for `triggerBy` shape**

In `packages/db/test/schema-definitions.test.ts`, add inside the `describe` block:

```ts
  it('workflow_instances.triggerBy has nested fields', () => {
    for (const schemas of [PLATFORM_TABLE_SCHEMAS, TENANT_TABLE_SCHEMAS]) {
      const table = schemas.find((t) => t.name === 'workflow_instances')
      expect(table).toBeDefined()
      const triggerBy = table!.columns.find((c) => c.name === 'triggerBy')
      expect(triggerBy).toBeDefined()
      expect(triggerBy!.dbType).toBe('object')
      expect(triggerBy!.fields?.map((f) => f.name)).toEqual(['type', 'startState'])
      expect(triggerBy!.fields?.[0].dbType).toBe('string')
      expect(triggerBy!.fields?.[1].dbType).toBe('string')
    }
  })
```

- [ ] **Step 4: Run the schema-definition tests**

Run: `pnpm vitest run packages/db/test/schema-definitions.test.ts`
Expected: all pass.

---

### Task 2: Add nested schema to `workflow_designs.starts`

**Files:**
- Modify: `packages/db/src/schema-definitions.ts:134` and `:209`
- Test: `packages/db/test/schema-definitions.test.ts`

- [ ] **Step 1: Update the platform `starts` column**

Replace:
```ts
  column('starts', 'object', 'json'),
```
with:
```ts
  column('starts', 'array', 'json', {
    fields: [
      column('type', 'string', 'select', {
        config: { options: buildOptions(['db_trigger', 'user_trigger', 'cron', 'webhook']) },
      }),
      column('startState', 'string', 'text'),
      column('options', 'object', 'json', { optional: true }),
    ],
  }),
```

- [ ] **Step 2: Update the tenant `starts` column**

In `packages/db/src/schema-definitions.ts:209`, make the same replacement.

- [ ] **Step 3: Add a test for `starts` shape**

In `packages/db/test/schema-definitions.test.ts`, add inside the `describe` block:

```ts
  it('workflow_designs.starts has nested item fields', () => {
    for (const schemas of [PLATFORM_TABLE_SCHEMAS, TENANT_TABLE_SCHEMAS]) {
      const table = schemas.find((t) => t.name === 'workflow_designs')
      expect(table).toBeDefined()
      const starts = table!.columns.find((c) => c.name === 'starts')
      expect(starts).toBeDefined()
      expect(starts!.dbType).toBe('array')
      expect(starts!.fields?.map((f) => f.name)).toEqual(['type', 'startState', 'options'])
      expect(starts!.fields?.[0].optional).toBe(true)
      expect(starts!.fields?.[1].optional).toBe(true)
      expect(starts!.fields?.[2].optional).toBe(true)
      expect(starts!.fields?.[2].dbType).toBe('object')
    }
  })
```

- [ ] **Step 4: Run the schema-definition tests**

Run: `pnpm vitest run packages/db/test/schema-definitions.test.ts`
Expected: all pass.

---

### Task 3: Typecheck and full DB test verification

**Files:** none

- [ ] **Step 1: Run the DB typecheck**

Run: `pnpm --filter db typecheck`
Expected: passes.

- [ ] **Step 2: Run the DB test suite**

Run: `pnpm --filter db test`
Expected: all tests pass, including schema-registry tests that validate the new nested definitions during seed/provision.

---

## Self-review checklist

- Spec coverage: both `triggerBy` and `starts` are updated in platform and tenant schemas, and tests assert the shapes.
- Placeholder scan: no TBD/TODO; code is exact.
- Type consistency: uses existing `column()` and `buildOptions` helpers; no new types introduced.
