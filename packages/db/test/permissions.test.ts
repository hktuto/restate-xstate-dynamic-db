import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createPermissionGroup,
  listPermissionGroups,
  assignPermissionGroup,
  removePermissionGroup,
  getEffectivePermissions,
  provisionDefaultCompanyGroups,
  applyPermissionToResource,
} from '../src/permissions.js'
import { createUserGroup } from '../src/user-groups.js'
import { createMember } from '../src/tenant.js'
import { getSurreal, closeSurreal } from '../src/client.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'

async function addUserGroupMember(namespace: string, memberId: string, userGroupId: string) {
  const { StringRecordId } = await import('surrealdb')
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query(
      'RELATE $memberId->user_group_memberships->$userGroupId',
      {
        memberId: new StringRecordId(memberId),
        userGroupId: new StringRecordId(userGroupId),
      }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

describe('permissions', () => {
  let namespace: string

  beforeEach(async () => {
    namespace = uniqueTenantName()
    await createTenantNamespace(namespace)
  })

  afterEach(async () => {
    await removeTenantNamespace(namespace)
  })

  it('creates a group and applies a bitmask via permission_apply_to', async () => {
    const member = await createMember(namespace, { email: 'm@example.com', role: 'member' })
    const group = await createPermissionGroup(namespace, 'main', {
      resourceType: 'tenant',
      name: 'viewer',
      isSystem: false,
    })
    await applyPermissionToResource(namespace, 'main', {
      groupId: group.id,
      resourceType: 'tenant',
      bitmask: 1,
      propagateMask: 0,
    })
    await assignPermissionGroup(namespace, 'main', member.id, group.id)
    const mask = await getEffectivePermissions(namespace, member.id, 'tenant', member.role)
    expect(mask).toBe('1')
  })

  it('gives owners all tenant permissions', async () => {
    const owner = await createMember(namespace, { email: 'o@example.com', role: 'owner' })
    const mask = await getEffectivePermissions(namespace, owner.id, 'tenant', owner.role)
    expect(mask).toBe('911')
  })

  it('provisions default tenant groups', async () => {
    const owner = await createMember(namespace, { email: 'o2@example.com', role: 'owner' })
    await provisionDefaultCompanyGroups(namespace, owner.id)
    const groups = await listPermissionGroups(namespace, 'main', 'tenant')
    expect(groups.map((g) => g.name)).toEqual(['owner', 'admin', 'user'])
  })

  it('inherits permissions from user-group membership', async () => {
    const member = await createMember(namespace, { email: 'group-member@example.com', role: 'member' })
    const userGroup = await createUserGroup(namespace, { name: 'Engineering' })
    await addUserGroupMember(namespace, member.id, userGroup.id)

    const group = await createPermissionGroup(namespace, 'main', {
      resourceType: 'tenant',
      name: 'group viewer',
      isSystem: false,
    })
    await applyPermissionToResource(namespace, 'main', {
      groupId: group.id,
      resourceType: 'tenant',
      bitmask: 3,
      propagateMask: 0,
    })
    await assignPermissionGroup(namespace, 'main', userGroup.id, group.id)

    const mask = await getEffectivePermissions(namespace, member.id, 'tenant', member.role)
    expect(mask).toBe('3')
  })

  it('applies type-level permission groups when resolving a specific record', async () => {
    const member = await createMember(namespace, { email: 'record-member@example.com', role: 'member' })

    const typeGroup = await createPermissionGroup(namespace, 'main', {
      resourceType: 'member',
      name: 'type viewer',
      isSystem: false,
    })
    await applyPermissionToResource(namespace, 'main', {
      groupId: typeGroup.id,
      resourceType: 'member',
      bitmask: 7,
      propagateMask: 0,
    })
    const recordGroup = await createPermissionGroup(namespace, 'main', {
      resourceType: 'member',
      recordId: 'members:rec1',
      name: 'record editor',
      isSystem: false,
    })
    await applyPermissionToResource(namespace, 'main', {
      groupId: recordGroup.id,
      resourceType: 'member',
      bitmask: 1,
      propagateMask: 0,
      recordId: 'members:rec1',
    })

    await assignPermissionGroup(namespace, 'main', member.id, typeGroup.id)
    await assignPermissionGroup(namespace, 'main', member.id, recordGroup.id)

    const typeOnlyMask = await getEffectivePermissions(namespace, member.id, 'member', member.role)
    expect(typeOnlyMask).toBe('7')

    const recordMask = await getEffectivePermissions(
      namespace,
      member.id,
      'member',
      member.role,
      'members:rec1'
    )
    expect(recordMask).toBe('7')
  })
})
