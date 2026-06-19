import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StringRecordId } from 'surrealdb'
import {
  createPermissionGroup,
  listPermissionGroups,
  assignPermissionGroup,
  removePermissionGroup,
  getEffectivePermissions,
  provisionDefaultCompanyGroups,
} from '../src/permissions.js'
import { createUserGroup } from '../src/user-groups.js'
import { createMember } from '../src/tenant.js'
import { getSurreal, closeSurreal } from '../src/client.js'
import { normalizeId } from '../src/normalize.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'

async function addUserGroupMember(namespace: string, memberId: string, userGroupId: string) {
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

  it('creates a group and resolves effective permissions', async () => {
    const member = await createMember(namespace, { email: 'm@example.com', role: 'member' })
    const group = await createPermissionGroup(namespace, {
      resourceType: 'company',
      name: 'Viewer',
      bitmask: '1',
      isSystem: false,
    })
    await assignPermissionGroup(namespace, member.id, group.id)
    const mask = await getEffectivePermissions(namespace, member.id, 'company', member.role)
    expect(mask).toBe('1')
  })

  it('gives owners all permissions', async () => {
    const owner = await createMember(namespace, { email: 'o@example.com', role: 'owner' })
    const mask = await getEffectivePermissions(namespace, owner.id, 'company', owner.role)
    expect(BigInt(mask)).toBe(63n)
  })

  it('provisions default company groups', async () => {
    const owner = await createMember(namespace, { email: 'o2@example.com', role: 'owner' })
    await provisionDefaultCompanyGroups(namespace, owner.id)
    const groups = await listPermissionGroups(namespace, 'company')
    expect(groups.map((g) => g.name)).toEqual(['Owner', 'Admin', 'Member'])
  })

  it('inherits permissions from user-group membership', async () => {
    const member = await createMember(namespace, { email: 'group-member@example.com', role: 'member' })
    const userGroup = await createUserGroup(namespace, { name: 'Engineering' })
    await addUserGroupMember(namespace, member.id, userGroup.id)

    const group = await createPermissionGroup(namespace, {
      resourceType: 'company',
      name: 'Group Viewer',
      bitmask: '2',
      isSystem: false,
    })
    await assignPermissionGroup(namespace, userGroup.id, group.id)

    const mask = await getEffectivePermissions(namespace, member.id, 'company', member.role)
    expect(mask).toBe('2')
  })

  it('applies type-level permission groups when resolving a specific record', async () => {
    const member = await createMember(namespace, { email: 'record-member@example.com', role: 'member' })

    const typeGroup = await createPermissionGroup(namespace, {
      resourceType: 'company',
      name: 'Type Viewer',
      bitmask: '4',
      isSystem: false,
    })
    const recordGroup = await createPermissionGroup(namespace, {
      resourceType: 'company',
      recordId: 'company:rec1',
      name: 'Record Editor',
      bitmask: '1',
      isSystem: false,
    })

    await assignPermissionGroup(namespace, member.id, typeGroup.id)
    await assignPermissionGroup(namespace, member.id, recordGroup.id)

    const typeOnlyMask = await getEffectivePermissions(namespace, member.id, 'company', member.role)
    expect(typeOnlyMask).toBe('4')

    const recordMask = await getEffectivePermissions(
      namespace,
      member.id,
      'company',
      member.role,
      'company:rec1'
    )
    expect(recordMask).toBe('5')
  })
})
