import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createUserGroup,
  listUserGroups,
  getUserGroupById,
  addUserGroupMember,
  removeUserGroupMember,
  listUserGroupMembers,
  createUserGroupWithDefaults,
} from '../src/user-groups.js'
import { createMember } from '../src/tenant.js'
import { getEffectivePermissions } from '../src/permissions.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'

describe('user groups', () => {
  let namespace: string

  beforeEach(async () => {
    namespace = uniqueTenantName()
    await createTenantNamespace(namespace)
  })

  afterEach(async () => {
    await removeTenantNamespace(namespace)
  })

  it('creates a user group with default record-level permission groups', async () => {
    const member = await createMember(namespace, { email: 'm@example.com', role: 'member' })
    const group = await createUserGroupWithDefaults(namespace, { name: 'Engineering' }, member.id)
    expect(group.id).toMatch(/^user_groups:/)

    const groups = await listUserGroups(namespace)
    expect(groups).toHaveLength(1)

    const mask = await getEffectivePermissions(namespace, member.id, 'user_group', member.role, group.id)
    expect(mask).toBe('63')
  })

  it('adds and removes members from a user group', async () => {
    const owner = await createMember(namespace, { email: 'o2@example.com', role: 'owner' })
    const member = await createMember(namespace, { email: 'm@example.com', role: 'member' })
    const group = await createUserGroup(namespace, { name: 'Ops' })

    await addUserGroupMember(namespace, member.id, group.id)
    let members = await listUserGroupMembers(namespace, group.id)
    expect(members).toHaveLength(1)

    await removeUserGroupMember(namespace, member.id, group.id)
    members = await listUserGroupMembers(namespace, group.id)
    expect(members).toHaveLength(0)
  })
})
