---
title: Nested Column Schema Implementation Plan
type: note
status: in-progress
area: docs
created: 2026-06-20
updated: 2026-06-20
---

# Nested Column Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recursive `fields` support to `_columns` and workflow-action inputs so object and `object[]` values can be described declaratively and rendered as nested forms.

**Architecture:** Extend `ColumnDefinition` with a recursive `fields` array, persist it on the schemaless `_columns` row, validate nested shapes in `schema-registry.ts`, mirror the same `fields` array on `ActionInputMetadata`, expand nested columns in `resolveInputs`, and render them with a new recursive `NestedFormInput.vue` component that keeps form values as nested objects/arrays.

**Tech Stack:** TypeScript, SurrealDB, Vue 3, Vitest.

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/db/src/schema-definitions.ts` | Add `fields?: ColumnDefinition[]` to `ColumnDefinition`. |
| `packages/db/src/schema-registry.ts` | Add `fields` to `ColumnInput`; persist and validate nested fields in `upsertColumn`; return them in `getTableSchema`. |
| `packages/db/test/schema-registry.test.ts` | Round-trip and validation tests for nested fields. |
| `packages/shared/src/index.ts` | Add `fields?: ActionInputMetadata[]` to `ActionInputMetadata`. |
| `packages/workflow-actions/src/catalog/resolve-inputs.ts` | Recursively expand `fields` when resolving table-driven inputs. |
| `packages/workflow-actions/tests/resolve-inputs.test.ts` | Test nested column expansion. |
| `layers/workflow-editor/components/NestedFormInput.vue` | New recursive component for object fieldsets and array-of-object lists. |
| `layers/workflow-editor/components/workflow-run-modal-helpers.ts` | Rewrite `buildPayload` to walk nested inputs and nested form values. |
| `layers/workflow-editor/components/WorkflowRunModal.vue` | Use `NestedFormInput` and store form values as nested objects/arrays. |
| `layers/workflow-editor/components/__tests__/WorkflowRunModal.test.ts` | Add nested payload tests. |

---

### Task 1: Make `ColumnDefinition` recursive

**Files:**
- Modify: `packages/db/src/schema-definitions.ts`

- [ ] **Step 1: Add `fields?: ColumnDefinition[]`**

```ts
export interface ColumnDefinition {
  name: string
  label?: string
  dbType: 'string' | 'number' | 'boolean' | 'datetime' | 'object' | 'array' | 'record'
  displayType: 'text' | 'url' | 'email' | 'user' | 'select' | 'checkbox' | 'date' | 'number' | 'relation' | 'formula' | 'richText' | 'json'
  config?: Record<string, unknown>
  fields?: ColumnDefinition[]
  system?: boolean
  unique?: boolean
  uniqueScope?: string
  optional?: boolean
  defaultValue?: unknown
  hidden?: boolean
  order?: number
}
```

- [ ] **Step 2: Typecheck the db package**

Run: `pnpm --filter db typecheck`
Expected: passes.

---

### Task 2: Persist and validate nested fields in the schema registry

**Files:**
- Modify: `packages/db/src/schema-registry.ts`

- [ ] **Step 1: Add `fields` to `ColumnInput`**

```ts
export interface ColumnInput {
  table: string
  name: string
  label?: string
  dbType: ColumnDefinition['dbType']
  displayType: ColumnDefinition['displayType']
  config?: Record<string, unknown>
  fields?: ColumnDefinition[]
  system?: boolean
  unique?: boolean
  uniqueScope?: string
  optional?: boolean
  defaultValue?: unknown
  hidden?: boolean
  order?: number
}
```

- [ ] **Step 2: Add a nested-field validator**

Add this helper before `upsertColumn`:

```ts
function validateColumnFields(fields: ColumnDefinition[] | undefined, path: string[] = []): void {
  if (!fields || fields.length === 0) return

  const seen = new Set<string>()

  for (const field of fields) {
    const fieldPath = [...path, field.name]
    const pathStr = fieldPath.join('.')

    if (!isValidIdentifier(field.name)) {
      throw new Error(`Invalid nested field name: ${pathStr}`)
    }
    if (seen.has(field.name)) {
      throw new Error(`Duplicate nested field name: ${pathStr}`)
    }
    seen.add(field.name)

    if (field.system) {
      throw new Error(`Nested field cannot be a system column: ${pathStr}`)
    }
    if (field.unique) {
      throw new Error(`Nested field cannot be unique: ${pathStr}`)
    }
    if (field.uniqueScope) {
      throw new Error(`Nested field cannot have a uniqueScope: ${pathStr}`)
    }
    if (field.order !== undefined) {
      throw new Error(`Nested field cannot have an order: ${pathStr}`)
    }

    if (field.fields && field.fields.length > 0) {
      if (field.dbType !== 'object' && field.dbType !== 'array') {
        throw new Error(`fields not allowed on dbType '${field.dbType}' at ${pathStr}`)
      }
      validateColumnFields(field.fields, fieldPath)
    }
  }
}
```

- [ ] **Step 3: Call validation and persist `fields` in `upsertColumn`**

Update `upsertColumn`:

1. After the system-column checks, call:
```ts
validateColumnFields(input.fields)
```

2. Add `fields = $fields` to the UPSERT query string between `config = $config,` and `system = $system,`.

3. Update the parameters object from:
```ts
{ ...input, config: input.config ?? {}, system: input.system ?? false, now }
```
to:
```ts
{ ...input, config: input.config ?? {}, system: input.system ?? false, fields: input.fields ?? null, now }
```

The full UPSERT block should look like:
```ts
await managed.query(
  `
  UPSERT ${id} SET
    table = $table,
    name = $name,
    label = $label,
    dbType = $dbType,
    displayType = $displayType,
    config = $config,
    fields = $fields,
    system = $system,
    unique = $unique,
    uniqueScope = $uniqueScope,
    optional = $optional,
    defaultValue = $defaultValue,
    hidden = $hidden,
    order = $order,
    updatedAt = $now,
    createdAt = IF missing THEN $now ELSE createdAt END
  `,
  { ...input, config: input.config ?? {}, system: input.system ?? false, fields: input.fields ?? null, now }
)
```

- [ ] **Step 4: Typecheck the db package**

Run: `pnpm --filter db typecheck`
Expected: passes.

---

### Task 3: Test schema-registry nested fields

**Files:**
- Modify: `packages/db/test/schema-registry.test.ts`

- [ ] **Step 1: Add a round-trip test for nested object fields**

Append inside the `describe('schema-registry', ...)` block:

```ts
it('upserts and retrieves nested object fields', async () => {
  await upsertColumn(testNs, 'main', {
    table: 'contacts',
    name: 'address',
    dbType: 'object',
    displayType: 'json',
    optional: true,
    fields: [
      { name: 'street', dbType: 'string', displayType: 'text' },
      { name: 'city', dbType: 'string', displayType: 'text' },
    ],
  })
  const schema = await getTableSchema(testNs, 'main', 'contacts')
  const address = schema!.columns.find((c) => c.name === 'address')
  expect(address?.fields).toHaveLength(2)
  expect(address?.fields?.map((f) => f.name)).toEqual(['street', 'city'])
})
```

- [ ] **Step 2: Add a round-trip test for array-of-object fields**

Append inside the same block:

```ts
it('upserts and retrieves array-of-object fields', async () => {
  await upsertColumn(testNs, 'main', {
    table: 'contacts',
    name: 'invoiceLines',
    dbType: 'array',
    displayType: 'json',
    optional: true,
    fields: [
      { name: 'id', dbType: 'string', displayType: 'text' },
      { name: 'date', dbType: 'datetime', displayType: 'date' },
      { name: 'item', dbType: 'string', displayType: 'text' },
      { name: 'total', dbType: 'number', displayType: 'number' },
    ],
  })
  const schema = await getTableSchema(testNs, 'main', 'contacts')
  const lines = schema!.columns.find((c) => c.name === 'invoiceLines')
  expect(lines?.fields).toHaveLength(4)
  expect(lines?.fields?.map((f) => f.name)).toEqual(['id', 'date', 'item', 'total'])
})
```

- [ ] **Step 3: Add validation tests**

Append inside the same block:

```ts
it('rejects nested fields on primitive dbTypes', async () => {
  await expect(
    upsertColumn(testNs, 'main', {
      table: 'contacts',
      name: 'bad',
      dbType: 'string',
      displayType: 'text',
      fields: [{ name: 'x', dbType: 'string', displayType: 'text' }],
    })
  ).rejects.toThrow("fields not allowed on dbType 'string'")
})

it('rejects duplicate nested field names', async () => {
  await expect(
    upsertColumn(testNs, 'main', {
      table: 'contacts',
      name: 'bad',
      dbType: 'object',
      displayType: 'json',
      fields: [
        { name: 'x', dbType: 'string', displayType: 'text' },
        { name: 'x', dbType: 'number', displayType: 'number' },
      ],
    })
  ).rejects.toThrow('Duplicate nested field name')
})

it('rejects system/unique/order on nested fields', async () => {
  await expect(
    upsertColumn(testNs, 'main', {
      table: 'contacts',
      name: 'bad',
      dbType: 'object',
      displayType: 'json',
      fields: [{ name: 'x', dbType: 'string', displayType: 'text', system: true }],
    })
  ).rejects.toThrow('system column')
})
```

- [ ] **Step 4: Run the schema-registry tests**

Run: `pnpm vitest run packages/db/test/schema-registry.test.ts`
Expected: all tests pass.

---

### Task 4: Make `ActionInputMetadata` recursive

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add `fields?: ActionInputMetadata[]`**

```ts
export interface ActionInputMetadata {
  name: string
  label: string
  dbType: 'string' | 'number' | 'boolean' | 'datetime' | 'record' | 'object' | 'array'
  displayType: 'text' | 'email' | 'url' | 'number' | 'select' | 'checkbox' | 'date' | 'json' | 'richText'
  description?: string
  required?: boolean
  hidden?: boolean
  defaultValue?: unknown
  config?: Record<string, unknown>
  fields?: ActionInputMetadata[]
}
```

- [ ] **Step 2: Typecheck shared**

Run: `pnpm --filter shared typecheck`
Expected: passes.

---

### Task 5: Expand nested columns in `resolveInputs`

**Files:**
- Modify: `packages/workflow-actions/src/catalog/resolve-inputs.ts`

- [ ] **Step 1: Add a recursive mapper**

Replace the `map` body with a helper. The file should become:

```ts
import type { WorkflowDefinition, ActionInputMetadata } from 'shared'
import { getTableSchema } from 'db/schema-registry'
import { actionsMetadata } from './actions.js'

function toActionDisplayType(displayType: string): ActionInputMetadata['displayType'] {
  const valid: ActionInputMetadata['displayType'][] = ['text', 'email', 'url', 'number', 'select', 'checkbox', 'date', 'json', 'richText']
  return valid.includes(displayType as ActionInputMetadata['displayType']) ? (displayType as ActionInputMetadata['displayType']) : 'text'
}

function mapColumnToInput(column: { name: string; label?: string; dbType: string; displayType: string; description?: string; required?: boolean; hidden?: boolean; defaultValue?: unknown; config?: Record<string, unknown>; fields?: ActionInputMetadata[] }): ActionInputMetadata {
  return {
    name: column.name,
    label: column.label ?? column.name,
    dbType: column.dbType as ActionInputMetadata['dbType'],
    displayType: toActionDisplayType(column.displayType),
    description: column.description ?? column.label,
    required: column.required,
    hidden: column.hidden,
    defaultValue: column.defaultValue,
    config: column.config,
    fields: column.fields?.map(mapColumnToInput),
  }
}

export async function resolveInputs(
  namespace: string,
  definition: WorkflowDefinition,
  stateId: string,
  database = 'main'
): Promise<ActionInputMetadata[]> {
  const state = definition.states[stateId]
  const actionId = state?.meta?.action as string | undefined
  if (!actionId) return []
  const meta = actionsMetadata.find((a) => a.id === actionId)
  if (!meta) return []
  if (meta.inputs) return meta.inputs
  if (meta.tableInput) {
    const tableName = (state?.meta?.params as Record<string, unknown>)?.[meta.tableInput] as string | undefined
    if (!tableName) return []
    const schema = await getTableSchema(namespace, database, tableName)
    if (!schema) return []
    return schema.columns
      .filter((c) => !c.system)
      .map(mapColumnToInput)
  }
  return []
}
```

- [ ] **Step 2: Typecheck workflow-actions**

Run: `pnpm --filter workflow-actions typecheck`
Expected: passes.

---

### Task 6: Test `resolveInputs` nested expansion

**Files:**
- Create: `packages/workflow-actions/tests/resolve-inputs.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('db/schema-registry', () => ({
  getTableSchema: vi.fn(),
}))

import { getTableSchema } from 'db/schema-registry'
import { resolveInputs } from '../src/catalog/resolve-inputs.js'

const definition = {
  id: 'test',
  initial: 'start',
  states: {
    start: {
      meta: {
        action: 'createRecord',
        params: { table: 'invoices' },
      },
    },
  },
} as any

describe('resolveInputs', () => {
  it('expands nested object and array-of-object columns', async () => {
    ;(getTableSchema as any).mockResolvedValue({
      table: { name: 'invoices' },
      columns: [
        {
          name: 'invoiceLines',
          dbType: 'array',
          displayType: 'json',
          optional: true,
          fields: [
            { name: 'id', dbType: 'string', displayType: 'text', optional: false },
            { name: 'date', dbType: 'datetime', displayType: 'date' },
            { name: 'item', dbType: 'string', displayType: 'text' },
            { name: 'total', dbType: 'number', displayType: 'number' },
          ],
        },
      ],
      relations: [],
    })

    const inputs = await resolveInputs('ns', definition, 'start')
    expect(inputs).toHaveLength(1)
    expect(inputs[0].name).toBe('invoiceLines')
    expect(inputs[0].dbType).toBe('array')
    expect(inputs[0].fields).toHaveLength(4)
    expect(inputs[0].fields?.map((f) => f.name)).toEqual(['id', 'date', 'item', 'total'])
  })
})
```

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run packages/workflow-actions/tests/resolve-inputs.test.ts`
Expected: passes.

---

### Task 7: Rewrite `buildPayload` for nested form values

**Files:**
- Modify: `layers/workflow-editor/components/workflow-run-modal-helpers.ts`

Form values will now be nested objects/arrays instead of flat strings, so `buildPayload` must walk the input tree and the value tree together.

- [ ] **Step 1: Replace the implementation**

```ts
import type { ActionInputMetadata } from 'shared'

export function buildPayload(
  inputs: ActionInputMetadata[],
  formValues: Record<string, unknown>
): { values: Record<string, unknown>; errors: string[] } {
  const values: Record<string, unknown> = {}
  const errors: string[] = []

  for (const input of inputs) {
    const { value, errors: fieldErrors } = processField(input, formValues[input.name])
    errors.push(...fieldErrors)
    values[input.name] = value
  }

  return { values, errors }
}

function processField(
  input: ActionInputMetadata,
  raw: unknown
): { value: unknown; errors: string[] } {
  const errors: string[] = []

  if (input.fields && input.fields.length > 0) {
    if (input.dbType === 'object') {
      const obj = isPlainObject(raw) ? raw : {}
      const result: Record<string, unknown> = {}
      for (const field of input.fields) {
        const { value: childValue, errors: childErrors } = processField(field, obj[field.name])
        errors.push(...childErrors)
        result[field.name] = childValue
      }
      return { value: result, errors }
    }

    if (input.dbType === 'array') {
      const itemSchema = input.fields[0]
      const arr = Array.isArray(raw) ? raw : []
      const result: unknown[] = []
      for (const item of arr) {
        const { value: itemValue, errors: itemErrors } = processField(itemSchema, item)
        errors.push(...itemErrors)
        result.push(itemValue)
      }
      return { value: result, errors }
    }
  }

  return processLeaf(input, raw, errors)
}

function processLeaf(
  input: ActionInputMetadata,
  raw: unknown,
  errors: string[]
): { value: unknown; errors: string[] } {
  if (input.required) {
    if (input.displayType === 'checkbox') {
      if (!raw) {
        errors.push(`${input.label} is required`)
        return { value: undefined, errors }
      }
    } else if (typeof raw !== 'string' || raw.trim() === '') {
      errors.push(`${input.label} is required`)
      return { value: undefined, errors }
    }
  }

  if (input.displayType === 'json' || input.displayType === 'richText') {
    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      return { value: undefined, errors }
    }
    if (typeof raw === 'string') {
      try {
        return { value: JSON.parse(raw), errors }
      } catch {
        errors.push(`${input.label} must be valid JSON`)
        return { value: undefined, errors }
      }
    }
    return { value: raw, errors }
  }

  if (input.displayType === 'number') {
    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      return { value: undefined, errors }
    }
    const num = Number(raw)
    if (Number.isNaN(num)) {
      errors.push(`${input.label} must be a valid number`)
      return { value: undefined, errors }
    }
    return { value: num, errors }
  }

  if (input.displayType === 'checkbox') {
    return { value: Boolean(raw), errors }
  }

  if (raw === undefined || raw === null) {
    return { value: '', errors }
  }
  return { value: String(raw), errors }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
```

- [ ] **Step 2: Typecheck the workflow-editor layer**

Run: `pnpm --filter workflow-editor typecheck` (or from root `pnpm -r typecheck` if the layer has a typecheck script)
Expected: passes.

---

### Task 8: Add nested payload tests

**Files:**
- Modify: `layers/workflow-editor/components/__tests__/WorkflowRunModal.test.ts`

- [ ] **Step 1: Add object-field tests**

Append inside the `describe('WorkflowRunModal buildPayload', ...)` block:

```ts
it('builds nested object values', () => {
  const inputs = [
    input({
      name: 'address',
      label: 'Address',
      displayType: 'json',
      dbType: 'object',
      fields: [
        input({ name: 'street', label: 'Street', displayType: 'text', dbType: 'string' }),
        input({ name: 'city', label: 'City', displayType: 'text', dbType: 'string' }),
      ],
    }),
  ]
  const { values, errors } = buildPayload(inputs, {
    address: { street: '123 Main', city: 'NYC' },
  })
  expect(errors).toEqual([])
  expect(values).toEqual({ address: { street: '123 Main', city: 'NYC' } })
})

it('reports missing required nested fields', () => {
  const inputs = [
    input({
      name: 'address',
      label: 'Address',
      displayType: 'json',
      dbType: 'object',
      fields: [
        input({ name: 'street', label: 'Street', displayType: 'text', dbType: 'string', required: true }),
      ],
    }),
  ]
  const { values, errors } = buildPayload(inputs, { address: { street: '' } })
  expect(errors).toEqual(['Street is required'])
  expect(values.address).toEqual({ street: undefined })
})
```

- [ ] **Step 2: Add array-of-object tests**

Append inside the same block:

```ts
it('builds array-of-object values', () => {
  const inputs = [
    input({
      name: 'invoiceLines',
      label: 'Invoice Lines',
      displayType: 'json',
      dbType: 'array',
      fields: [
        input({ name: 'id', label: 'ID', displayType: 'text', dbType: 'string' }),
        input({ name: 'date', label: 'Date', displayType: 'date', dbType: 'datetime' }),
        input({ name: 'item', label: 'Item', displayType: 'text', dbType: 'string' }),
        input({ name: 'total', label: 'Total', displayType: 'number', dbType: 'number' }),
      ],
    }),
  ]
  const { values, errors } = buildPayload(inputs, {
    invoiceLines: [
      { id: 'a', date: '2026-06-19', item: 'Widget', total: '10' },
      { id: 'b', date: '2026-06-20', item: 'Gadget', total: '20' },
    ],
  })
  expect(errors).toEqual([])
  expect(values).toEqual({
    invoiceLines: [
      { id: 'a', date: '2026-06-19', item: 'Widget', total: 10 },
      { id: 'b', date: '2026-06-20', item: 'Gadget', total: 20 },
    ],
  })
})
```

- [ ] **Step 3: Run the workflow-editor tests**

Run: `pnpm vitest run layers/workflow-editor/components/__tests__/WorkflowRunModal.test.ts`
Expected: passes.

---

### Task 9: Create the recursive `NestedFormInput.vue` component

**Files:**
- Create: `layers/workflow-editor/components/NestedFormInput.vue`

- [ ] **Step 1: Create the component file**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { ActionInputMetadata } from 'shared'

const props = defineProps<{
  input: ActionInputMetadata
  modelValue: unknown
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
}>()

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

function ensureObject(): Record<string, unknown> {
  if (typeof value.value === 'object' && value.value !== null && !Array.isArray(value.value)) {
    return value.value as Record<string, unknown>
  }
  const obj: Record<string, unknown> = {}
  value.value = obj
  return obj
}

function ensureArray(): unknown[] {
  if (Array.isArray(value.value)) {
    return value.value
  }
  const arr: unknown[] = []
  value.value = arr
  return arr
}

function addArrayItem() {
  const arr = ensureArray()
  arr.push({})
}

function removeArrayItem(index: number) {
  const arr = ensureArray()
  arr.splice(index, 1)
}

function getSelectOptions(input: ActionInputMetadata): { label: string; value: string }[] {
  const opts = input.config?.options
  if (!Array.isArray(opts)) return []
  return opts.filter((o): o is { label: string; value: string } => {
    return typeof o === 'object' && o !== null && typeof o.label === 'string' && typeof o.value === 'string'
  })
}

function initialPrimitiveValue(input: ActionInputMetadata): unknown {
  if (input.defaultValue !== undefined) return input.defaultValue
  if (input.displayType === 'checkbox') return false
  if (input.displayType === 'number') return 0
  return ''
}

function onPrimitiveInput(event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  if (props.input.displayType === 'checkbox') {
    value.value = (target as HTMLInputElement).checked
  } else if (props.input.displayType === 'number') {
    value.value = target.value
  } else {
    value.value = target.value
  }
}
</script>

<template>
  <fieldset v-if="input.fields && input.dbType === 'object'" class="border rounded p-3 mb-3">
    <legend class="text-sm font-medium mb-2">{{ input.label }}</legend>
    <NestedFormInput
      v-for="field in input.fields"
      :key="field.name"
      :input="field"
      v-model="ensureObject()[field.name]"
    />
  </fieldset>

  <div v-else-if="input.fields && input.dbType === 'array'" class="mb-3">
    <label class="block text-sm font-medium mb-1">{{ input.label }}</label>
    <div
      v-for="(item, index) in ensureArray()"
      :key="index"
      class="border rounded p-3 mb-2"
    >
      <NestedFormInput
        :input="{ name: '', label: `Item ${index + 1}`, dbType: 'object', displayType: 'json', fields: input.fields }"
        v-model="ensureArray()[index]"
      />
      <button
        type="button"
        class="text-xs text-red-600 mt-2"
        @click="removeArrayItem(index)"
      >
        Remove
      </button>
    </div>
    <button
      type="button"
      class="text-xs text-blue-600"
      @click="addArrayItem"
    >
      Add item
    </button>
  </div>

  <div v-else class="mb-3">
    <label class="block text-sm font-medium mb-1">
      {{ input.label }}
      <span v-if="input.required" class="text-red-600">*</span>
    </label>

    <select
      v-if="input.displayType === 'select'"
      :value="String(value ?? '')"
      class="w-full border rounded p-2"
      :required="input.required"
      @change="value = ($event.target as HTMLSelectElement).value"
    >
      <option value="">Select…</option>
      <option v-for="opt in getSelectOptions(input)" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>

    <input
      v-else-if="input.displayType === 'checkbox'"
      :checked="Boolean(value ?? false)"
      type="checkbox"
      class="w-5 h-5"
      @change="value = ($event.target as HTMLInputElement).checked"
    />

    <textarea
      v-else-if="input.displayType === 'json' || input.displayType === 'richText'"
      :value="typeof value === 'string' ? value : JSON.stringify(value ?? initialPrimitiveValue(input))"
      rows="4"
      class="w-full border rounded p-2 font-mono text-sm"
      :required="input.required"
      @input="value = ($event.target as HTMLTextAreaElement).value"
    />

    <input
      v-else
      :value="String(value ?? initialPrimitiveValue(input))"
      :type="input.displayType"
      class="w-full border rounded p-2"
      :required="input.required"
      @input="value = ($event.target as HTMLInputElement).value"
    />
  </div>
</template>
```

- [ ] **Step 2: Typecheck the layer**

Run the workflow-editor typecheck command.
Expected: passes.

---

### Task 10: Wire `NestedFormInput` into `WorkflowRunModal`

**Files:**
- Modify: `layers/workflow-editor/components/WorkflowRunModal.vue`

- [ ] **Step 1: Update imports and form-values shape**

Replace:
```ts
import { buildPayload } from './workflow-run-modal-helpers.js'
```
with:
```ts
import NestedFormInput from './NestedFormInput.vue'
import { buildPayload } from './workflow-run-modal-helpers.js'
```

Replace:
```ts
const formValues = ref<Record<string, string | boolean>>({})
```
with:
```ts
const formValues = ref<Record<string, unknown>>({})
```

- [ ] **Step 2: Update `getInitialValue`**

Replace the `getInitialValue` function with:

```ts
function getInitialValue(input: ActionInputMetadata): unknown {
  if (input.defaultValue !== undefined) return input.defaultValue
  if (input.fields && input.fields.length > 0) {
    if (input.dbType === 'array') return []
    if (input.dbType === 'object') return {}
  }
  if (input.displayType === 'checkbox') return false
  if (input.displayType === 'number') return 0
  return ''
}
```

- [ ] **Step 3: Remove flat helper functions**

Delete these functions: `getInputValue`, `isChecked`, `setInputValue`, `isSelectOption`, `getSelectOptions`.

- [ ] **Step 4: Replace the input rendering loop**

Replace the `<div v-for="input in inputs" ...>` block with:

```vue
<div v-for="input in inputs" :key="input.name" class="mb-4">
  <NestedFormInput :input="input" v-model="formValues[input.name]" />
</div>
```

- [ ] **Step 5: Typecheck and run component tests**

Run:
```bash
pnpm vitest run layers/workflow-editor/components/__tests__/WorkflowRunModal.test.ts
```
Expected: passes.

---

### Task 11: Run the full relevant test suites

- [ ] **Step 1: db tests**

Run: `pnpm --filter db test`
Expected: all pass.

- [ ] **Step 2: workflow-actions tests**

Run: `pnpm vitest run packages/workflow-actions/tests`
Expected: all pass.

- [ ] **Step 3: workflow-editor tests**

Run: `pnpm vitest run layers/workflow-editor`
Expected: all pass.

- [ ] **Step 4: monorepo typecheck**

Run: `pnpm -r typecheck`
Expected: all packages pass.

---

## Self-review against the spec

| Spec requirement | Task that implements it |
|------------------|-------------------------|
| Recursive `fields` on `ColumnDefinition` | Task 1 |
| Persist nested fields in `_columns` | Task 2 |
| Validate nested field rules | Task 2 + Task 3 |
| Recursive `fields` on `ActionInputMetadata` | Task 4 |
| Expand nested columns in `resolveInputs` | Task 5 + Task 6 |
| Render nested object fieldsets | Task 9 + Task 10 |
| Render array-of-object lists with add/remove | Task 9 + Task 10 |
| Build payload from nested form values | Task 7 + Task 8 |
| Backward compatibility for columns without `fields` | All tasks (primitive path unchanged; absent `fields` falls back to JSON/leaf behavior) |
| Tests | Tasks 3, 6, 8, 10, 11 |

No placeholders remain. All type names (`ColumnDefinition`, `ActionInputMetadata`, `resolveInputs`, `buildPayload`) are consistent across tasks.