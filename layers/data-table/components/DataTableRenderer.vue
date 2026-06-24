<script setup lang="ts">
import type { TableColumnConfig, TableSchema, ViewDefinition } from 'shared'

interface Props {
  view: ViewDefinition
  rows: Record<string, unknown>[]
  schema: TableSchema
  columns?: TableColumnConfig[]
}

const props = defineProps<Props>()

const columnMap = computed(() => {
  const map = new Map<string, TableSchema['columns'][number]>()
  for (const col of props.schema.columns) {
    map.set(col.name, col)
  }
  return map
})

interface VisibleColumn {
  key: string
  config: TableColumnConfig
  column?: TableSchema['columns'][number]
  label: string
  displayType: string
  resolve: (row: Record<string, unknown>) => unknown
}

const visibleColumns = computed<VisibleColumn[]>(() => {
  const configs = props.columns ?? props.view.config?.table?.columns ?? []
  const result: VisibleColumn[] = []
  for (const config of configs) {
    if (config.visible === false) continue

    if (config.type === 'lookup' && config.lookup) {
      const alias = config.label || config.lookup.relation
      const fieldSuffix = config.lookup.agg === 'count' ? '' : `.${config.lookup.field ?? ''}`
      const label = config.label || `${config.lookup.relation}${fieldSuffix}${config.lookup.agg ? ` (${config.lookup.agg})` : ''}`
      result.push({
        key: alias,
        config,
        label,
        displayType: 'text',
        resolve: (row) => row[alias],
      })
      continue
    }

    if (!config.column) continue
    const column = columnMap.value.get(config.column)
    if (!column) continue
    result.push({
      key: config.column,
      config,
      column,
      label: config.label ?? column.label ?? column.name,
      displayType: column.displayType,
      resolve: (row) => row[config.column!],
    })
  }
  return result
})

function formatValue(value: unknown, displayType: string): string {
  if (value === null || value === undefined) return ''
  if (displayType === 'date' && typeof value === 'string') {
    try {
      return new Date(value).toLocaleString()
    } catch {
      return String(value)
    }
  }
  if (displayType === 'checkbox') {
    return value ? 'Yes' : 'No'
  }
  if (Array.isArray(value)) {
    return value.map((v) => (v === null || v === undefined ? '' : String(v))).filter(Boolean).join(', ')
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function columnWidth(config: { width?: 'auto' | number }): string {
  if (config.width === undefined || config.width === 'auto') return 'auto'
  return `${config.width}px`
}

const TAG_COLOR_CLASSES: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  purple: 'bg-purple-100 text-purple-800',
  pink: 'bg-pink-100 text-pink-800',
  orange: 'bg-orange-100 text-orange-800',
  teal: 'bg-teal-100 text-teal-800',
  cyan: 'bg-cyan-100 text-cyan-800',
}

function tagColor(value: unknown, config?: Record<string, unknown>): string {
  const key = String(value ?? '')
  const colors = config?.tagColors
  if (colors && typeof colors === 'object' && key in colors) {
    const mapped = (colors as Record<string, unknown>)[key]
    if (typeof mapped === 'string') return mapped
  }
  const fallback = config?.defaultColor
  if (typeof fallback === 'string') return fallback
  return 'gray'
}

function tagClasses(value: unknown, config?: Record<string, unknown>): string {
  const color = tagColor(value, config)
  return TAG_COLOR_CLASSES[color] ?? 'bg-gray-100 text-gray-800'
}
</script>

<template>
  <div class="overflow-x-auto rounded border border-gray-200">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th
            v-for="{ config, key, label } in visibleColumns"
            :key="key"
            class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            :style="{ width: columnWidth(config), minWidth: columnWidth(config) }"
          >
            {{ label }}
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr v-for="(row, rowIndex) in rows" :key="rowIndex" class="hover:bg-gray-50">
          <td
            v-for="{ config, key, column, displayType, resolve } in visibleColumns"
            :key="key"
            class="px-4 py-3 whitespace-nowrap text-sm text-gray-900"
            :style="{ width: columnWidth(config), minWidth: columnWidth(config) }"
          >
            <template v-if="displayType === 'email' && typeof resolve(row) === 'string'">
              <a :href="`mailto:${resolve(row)}`" class="text-blue-600 hover:underline">
                {{ resolve(row) }}
              </a>
            </template>
            <template v-else-if="displayType === 'tag'">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                :class="tagClasses(resolve(row), column?.config)"
              >
                {{ formatValue(resolve(row), 'text') }}
              </span>
            </template>
            <template v-else>
              {{ formatValue(resolve(row), displayType) }}
            </template>
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td :colspan="visibleColumns.length" class="px-4 py-8 text-center text-sm text-gray-500">
            No records found
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
