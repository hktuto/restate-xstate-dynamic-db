import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defaultGroups } from 'shared'
import { seedCompany } from '../scripts/seed-company.js'
import { getCompanyBySlug, getAccountByProviderKey } from '../src/platform.js'
import { getMemberByProfileId, listMembers } from '../src/tenant.js'
import { getEffectivePermissions, listPermissionGroups } from '../src/permissions.js'
import { listUserGroups, listUserGroupMembers } from '../src/user-groups.js'
import { createTenantNamespace, removeTenantNamespace } from './helpers.js'

describe('seedCompany', () => {
  beforeEach(async () => {
    await createTenantNamespace('platform')
  })

  afterEach(async () => {
    await removeTenantNamespace('company_seedco_test')
    await removeTenantNamespace('platform')
  })

  it('creates the seed company', async () => {
    await seedCompany()
    const company = await getCompanyBySlug('seedco-test')
    expect(company).toBeDefined()
    expect(company?.name).toBe('SeedCo Test')

    const ownerAccount = await getAccountByProviderKey('email', 'owner@seedco.test')
    expect(ownerAccount).toBeDefined()
    const ownerMember = await getMemberByProfileId('company_seedco_test', ownerAccount!.profileId)
    expect(ownerMember).toBeDefined()
    expect(ownerMember?.role).toBe('owner')

    const members = await listMembers('company_seedco_test')
    expect(members).toHaveLength(13)

    const memberGroups = await listPermissionGroups('company_seedco_test', 'main', 'member')
    const adminGroup = memberGroups.find((g) => g.name === 'admin')
    const userGroup = memberGroups.find((g) => g.name === 'user')
    expect(adminGroup).toBeDefined()
    expect(userGroup).toBeDefined()

    const memberDefaults = defaultGroups('member')
    const adminMask = memberDefaults.find((g) => g.name === 'admin')!.bitmask.toString()
    const userMask = memberDefaults.find((g) => g.name === 'user')!.bitmask.toString()

    const alice = members.find((m) => m.email === 'alice@seedco.test')
    const charlie = members.find((m) => m.email === 'charlie@seedco.test')
    expect(alice).toBeDefined()
    expect(charlie).toBeDefined()

    const aliceMask = await getEffectivePermissions('company_seedco_test', alice!.id, 'member', alice!.role)
    const charlieMask = await getEffectivePermissions('company_seedco_test', charlie!.id, 'member', charlie!.role)
    expect(aliceMask).toBe(adminMask)
    expect(charlieMask).toBe(userMask)

    const tenantGroups = await listPermissionGroups('company_seedco_test', 'main', 'tenant')
    const tenantOwnerGroup = tenantGroups.find((g) => g.name === 'owner')
    const tenantAdminGroup = tenantGroups.find((g) => g.name === 'admin')
    expect(tenantOwnerGroup).toBeDefined()
    expect(tenantAdminGroup).toBeDefined()

    const tenantDefaults = defaultGroups('tenant')
    const tenantOwnerMask = tenantDefaults.find((g) => g.name === 'owner')!.bitmask.toString()
    const tenantOwnerEffectiveMask = await getEffectivePermissions(
      'company_seedco_test',
      ownerMember!.id,
      'tenant',
      ownerMember!.role
    )
    expect(tenantOwnerEffectiveMask).toBe(tenantOwnerMask)

    const userGroups = await listUserGroups('company_seedco_test')
    expect(userGroups).toHaveLength(3)
    const engineering = userGroups.find((g) => g.name === 'Engineering')
    const product = userGroups.find((g) => g.name === 'Product')
    const finance = userGroups.find((g) => g.name === 'Finance')
    expect(engineering).toBeDefined()
    expect(product).toBeDefined()
    expect(finance).toBeDefined()

    const engineeringMembers = await listUserGroupMembers('company_seedco_test', engineering!.id)
    const productMembers = await listUserGroupMembers('company_seedco_test', product!.id)
    const financeMembers = await listUserGroupMembers('company_seedco_test', finance!.id)
    expect(engineeringMembers).toHaveLength(5)
    expect(productMembers).toHaveLength(4)
    expect(financeMembers).toHaveLength(3)

    const engineeringGroups = await listPermissionGroups('company_seedco_test', 'main', 'user_group_detail', engineering!.id)
    const engineeringOwnerGroup = engineeringGroups.find((g) => g.name === 'owner')
    expect(engineeringOwnerGroup).toBeDefined()
    const detailDefaults = defaultGroups('user_group_detail')
    const ownerMask = detailDefaults.find((g) => g.name === 'owner')!.bitmask.toString()
    const aliceEngineeringMask = await getEffectivePermissions('company_seedco_test', alice!.id, 'user_group_detail', alice!.role, engineering!.id)
    expect((Number(aliceEngineeringMask) & Number(ownerMask)).toString()).toBe(ownerMask)
  })
})
