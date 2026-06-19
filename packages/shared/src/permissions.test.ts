import { describe, it, expect } from 'vitest'
import {
  actionValue,
  actionsToBitmask,
  bitmaskToActions,
  hasAction,
  allActionsBitmask,
  DEFAULT_GROUPS,
  RESOURCE_ACTIONS,
} from './permissions.js'

describe('permissions', () => {
  it('converts actions to values and back', () => {
    expect(actionValue('company', 'manage_settings')).toBe(2n)
    expect(actionValue('user_group', 'add_member')).toBe(8n)
  })

  it('builds and decodes a bitmask', () => {
    const mask = actionsToBitmask('user_group', ['view', 'update', 'add_member'])
    expect(mask).toBe('11')
    expect(bitmaskToActions('user_group', mask)).toEqual(['view', 'update', 'add_member'])
  })

  it('checks a single action', () => {
    const mask = actionsToBitmask('company', ['view', 'manage_user_groups'])
    expect(hasAction(mask, 'company', 'view')).toBe(true)
    expect(hasAction(mask, 'company', 'invite_member')).toBe(false)
  })

  it('returns all actions for a resource type', () => {
    const mask = allActionsBitmask('user_group')
    expect(hasAction(mask, 'user_group', 'manage_permissions')).toBe(true)
  })

  it('has default groups', () => {
    expect(DEFAULT_GROUPS.company.map((g) => g.name)).toContain('Owner')
    expect(DEFAULT_GROUPS.user_group.map((g) => g.name)).toContain('Admin')
  })
})
