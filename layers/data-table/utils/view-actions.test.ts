import { describe, expect, it } from 'vitest'
import type { ResourceActionPlacement, ViewActionBindings } from 'shared'
import { resolveViewActions } from './view-actions.js'

const placements: Record<string, ResourceActionPlacement[]> = {
  create: [
    { type: ['table'], location: 'toolbar', component: 'CreateButton', method: null },
  ],
  edit: [
    { type: ['table'], location: 'item-contextMenu', component: 'EditAction', method: 'open' },
    { type: ['table'], location: 'item-rowDoubleClick', component: 'EditAction', method: 'open' },
  ],
  delete: [
    { type: ['table'], location: 'item-*', component: 'DeleteAction', method: 'open' },
  ],
  edit_schema: [
    { type: ['table'], location: 'toolbar', component: 'EditSchema', method: null },
  ],
  manage_permissions: [
    { type: ['table'], location: 'toolbar', component: 'ManagePermissions', method: null },
  ],
}

describe('resolveViewActions', () => {
  it('resolves toolbar actions', () => {
    const bindings: ViewActionBindings = { toolbar: ['create'] }
    const result = resolveViewActions('table', bindings, placements)

    expect(result.toolbar).toHaveLength(1)
    expect(result.toolbar[0]).toEqual({ action: 'create', component: 'CreateButton', method: null })
  })

  it('resolves context menu actions', () => {
    const bindings: ViewActionBindings = { 'item-contextMenu': ['edit', 'delete'] }
    const result = resolveViewActions('table', bindings, placements)

    expect(result.itemContextMenu).toEqual([
      { action: 'edit', component: 'EditAction', method: 'open' },
      { action: 'delete', component: 'DeleteAction', method: 'open' },
    ])
  })

  it('resolves a single row double-click action', () => {
    const bindings: ViewActionBindings = { 'item-rowDoubleClick': ['edit'] }
    const result = resolveViewActions('table', bindings, placements)

    expect(result.rowDoubleClick).toEqual({ action: 'edit', component: 'EditAction', method: 'open' })
  })

  it('skips bindings that have no matching placement', () => {
    const bindings: ViewActionBindings = { toolbar: ['create', 'unknown'] }
    const result = resolveViewActions('table', bindings, placements)

    expect(result.toolbar).toHaveLength(1)
    expect(result.toolbar[0]!.action).toBe('create')
  })

  it('returns empty arrays when bindings are undefined', () => {
    const result = resolveViewActions('table', undefined, placements)

    expect(result.toolbar).toHaveLength(0)
    expect(result.itemContextMenu).toHaveLength(0)
    expect(result.rowDoubleClick).toBeUndefined()
  })

  it('matches wildcard locations', () => {
    const bindings: ViewActionBindings = { 'item-contextMenu': ['delete'] }
    const result = resolveViewActions('table', bindings, placements)

    expect(result.itemContextMenu).toEqual([
      { action: 'delete', component: 'DeleteAction', method: 'open' },
    ])
  })

  it('resolves meta-actions into toolbar', () => {
    const bindings: ViewActionBindings = { toolbar: ['edit_schema', 'manage_permissions'] }
    const result = resolveViewActions('table', bindings, placements)

    expect(result.toolbar).toEqual([
      { action: 'edit_schema', component: 'EditSchema', method: null },
      { action: 'manage_permissions', component: 'ManagePermissions', method: null },
    ])
  })
})
