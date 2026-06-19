import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createPermissionGroup,
  listPermissionGroups,
  assignPermissionGroup,
  removePermissionGroup,
  getEffectivePermissions,
  provisionDefaultCompanyGroups,
} from '../src/permissions.js'
import { createMember } from '../src/tenant.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'

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
})
