import { describe, it, expect } from 'vitest'
import {
  actionValue,
  actionsToBitmask,
  bitmaskToActions,
  hasAction,
  allActionsBitmask,
  defaultGroups,
  resourceType,
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

  it('expands compound bits when decoding a bitmask', () => {
    const mask = actionsToBitmask('member', ['edit'])
    expect(hasAction(mask, 'member', 'view')).toBe(true)
    expect(bitmaskToActions('member', mask)).toContain('view')
  })

  it('checks compound action masks with hasAction', () => {
    // 19 = add_member = view(1) | edit(2) | add_member(16)
    expect(hasAction(19, 'user_group', 'view')).toBe(true)
    expect(hasAction(19, 'user_group', 'edit_info')).toBe(true)
    expect(hasAction(19, 'user_group', 'add_member')).toBe(true)
    expect(hasAction(19, 'user_group', 'remove_member')).toBe(false)
  })

  it('throws for unknown resources and actions', () => {
    // @ts-expect-error unknown resource
    expect(() => resourceType('unknown_resource')).toThrow('Unknown resource type')
    // @ts-expect-error unknown action
    expect(() => actionValue('company', 'fly')).toThrow('Unknown action')
  })

  it('exposes lowercase default groups with computed masks', () => {
    const groups = defaultGroups('company')
    const names = groups.map((g) => g.name)
    expect(names).toEqual(['owner', 'admin', 'user'])

    const owner = groups.find((g) => g.name === 'owner')!
    const admin = groups.find((g) => g.name === 'admin')!
    const user = groups.find((g) => g.name === 'user')!

    expect(owner.bitmask).toBe(owner.propagateMask)
    expect(admin.bitmask).toBe(admin.propagateMask)
    expect(user.propagateMask).toBe(0)

    // owner/admin include all actions; user is view-only.
    expect(hasAction(owner.bitmask, 'company', 'manage_permissions')).toBe(true)
    expect(hasAction(user.bitmask, 'company', 'view')).toBe(true)
    expect(hasAction(user.bitmask, 'company', 'edit_info')).toBe(false)
  })
})
