<script setup lang="ts">
import type { ViewDefinition } from 'shared'

interface PageConfig {
  resource: string
  view?: string | ViewDefinition
  canUpdateView?: boolean
  canEditSchema?: boolean
  canManagePermissions?: boolean
}

interface Props {
  config: PageConfig
}

const props = defineProps<Props>()
</script>

<template>
  <ViewRenderer
    :resource="props.config.resource"
    :view="props.config.view"
    :can-update-view="props.config.canUpdateView"
    :can-edit-schema="props.config.canEditSchema"
    :can-manage-permissions="props.config.canManagePermissions"
  />
</template>
