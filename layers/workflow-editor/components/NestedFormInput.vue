<script setup lang="ts">
import { computed, useId } from 'vue'
import type { ActionInputMetadata } from 'shared'

const props = defineProps<{
  input: ActionInputMetadata
  modelValue: unknown
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
}>()

const controlId = useId()

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const objectValue = computed<Record<string, unknown>>(() => {
  return isPlainObject(value.value) ? value.value : {}
})

const arrayValue = computed<unknown[]>(() => {
  return Array.isArray(value.value) ? value.value : []
})

const itemInput = computed<ActionInputMetadata>(() => ({
  name: '',
  label: '',
  dbType: 'object',
  displayType: 'json',
  fields: props.input.fields,
}))

function updateObjectField(name: string, fieldValue: unknown) {
  value.value = { ...objectValue.value, [name]: fieldValue }
}

function addArrayItem() {
  value.value = [...arrayValue.value, {}]
}

function updateArrayItem(index: number, itemValue: unknown) {
  const next = [...arrayValue.value]
  next[index] = itemValue
  value.value = next
}

function removeArrayItem(index: number) {
  value.value = arrayValue.value.filter((_, i) => i !== index)
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
  return ''
}

function parseInputValue(displayType: ActionInputMetadata['displayType'], raw: string): unknown {
  if (displayType === 'number') {
    if (raw === '') return ''
    const num = Number(raw)
    if (!Number.isFinite(num)) return raw
    return String(num) === raw ? num : raw
  }
  return raw
}
</script>

<template>
  <template v-if="!input.hidden">
    <fieldset v-if="input.fields && input.dbType === 'object'" class="border rounded p-3 mb-3">
      <legend class="text-sm font-medium mb-2">{{ input.label }}</legend>
      <NestedFormInput
        v-for="field in input.fields"
        :key="field.name"
        :input="field"
        :modelValue="objectValue[field.name]"
        @update:modelValue="updateObjectField(field.name, $event)"
      />
    </fieldset>

    <div v-else-if="input.fields && input.dbType === 'array'" class="mb-3">
      <label class="block text-sm font-medium mb-1">{{ input.label }}</label>
      <div
        v-for="(item, index) in arrayValue"
        :key="index"
        class="border rounded p-3 mb-2"
      >
        <NestedFormInput
          :input="itemInput"
          :modelValue="arrayValue[index]"
          @update:modelValue="updateArrayItem(index, $event)"
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
      <template v-if="input.displayType === 'checkbox'">
        <label class="block text-sm font-medium mb-1">
          <input
            :checked="Boolean(value ?? false)"
            type="checkbox"
            class="w-5 h-5 mr-2 align-middle"
            @change="value = ($event.target as HTMLInputElement).checked"
          />
          {{ input.label }}
          <span v-if="input.required" class="text-red-600">*</span>
        </label>
      </template>

      <template v-else>
        <label :for="controlId" class="block text-sm font-medium mb-1">
          {{ input.label }}
          <span v-if="input.required" class="text-red-600">*</span>
        </label>

        <select
          v-if="input.displayType === 'select'"
          :id="controlId"
          :value="String(value ?? '')"
          class="w-full border rounded p-2"
          :required="input.required"
          @change="value = ($event.target as HTMLSelectElement).value"
        >
          <option value="">Select…</option>
          <option v-for="opt in getSelectOptions(input)" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>

        <textarea
          v-else-if="input.displayType === 'json' || input.displayType === 'richText'"
          :id="controlId"
          :value="typeof value === 'string' ? value : (value === undefined || value === null ? '' : JSON.stringify(value))"
          rows="4"
          class="w-full border rounded p-2 font-mono text-sm"
          :required="input.required"
          @input="value = ($event.target as HTMLTextAreaElement).value"
        />

        <input
          v-else
          :id="controlId"
          :type="input.displayType === 'number' ? 'text' : input.displayType"
          :inputmode="input.displayType === 'number' ? 'decimal' : undefined"
          :pattern="input.displayType === 'number' ? '[0-9]*[.,]?[0-9]*' : undefined"
          :value="String(value ?? initialPrimitiveValue(input))"
          class="w-full border rounded p-2"
          :required="input.required"
          @input="value = parseInputValue(input.displayType, ($event.target as HTMLInputElement).value)"
        />
      </template>
    </div>
  </template>
</template>
