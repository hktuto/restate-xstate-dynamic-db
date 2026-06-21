import { describe, it, expect } from 'vitest'
import {
  actionValue,
  actionsToBitmask,
  bitmaskToActions,
  hasAction,
  allActionsBitmask,
  defaultGroups,
} from './permissions.js'

describe('permissions', () => {
  it('returns compound action values from the catalog', () => {
    expect(actionValue('member', 'edit')).toBe(3)
    expect(actionValue('company', 'add_member')).toBe(19)
  })

  it('builds and decodes a bitmask using compound values', () => {
    const mask = actionsToBitmask('user_group', ['view', 'edit_info', 'add_member'])
    expect(mask).toBe('19')
    expect(bitmaskToActions('user_group', mask)).toEqual(['view', 'edit_info', 'add_member'])
  })

  it('checks a single action with compound masks', () => {
    const mask = actionsToBitmask('company', ['view', 'add_member'])
    expect(hasAction(mask, 'company', 'view')).toBe(true)
    expect(hasAction(mask, 'company', 'remove_member')).toBe(false)
    expect(hasAction(mask, 'company', 'delete')).toBe(false)
  })

  it('returns all actions for a resource type', () => {
    const mask = allActionsBitmask('member')
    expect(hasAction(mask, 'member', 'manage_permissions')).toBe(true)
  })

  it('has default groups', () => {
    expect(defaultGroups('company').map((g) => g.name)).toContain('owner')
    expect(defaultGroups('user_group').map((g) => g.name)).toContain('admin')
  })
})
