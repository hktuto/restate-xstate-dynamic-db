import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { seedCompany } from '../scripts/seed-company.js'
import { getCompanyBySlug, getAccountByProviderKey } from '../src/platform.js'
import { getMemberByProfileId, listMembers } from '../src/tenant.js'
import { getEffectivePermissions, listPermissionGroups } from '../src/permissions.js'
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

    const companyGroups = await listPermissionGroups('company_seedco_test', 'company')
    const adminGroup = companyGroups.find((g) => g.name === 'Admin')
    const memberGroup = companyGroups.find((g) => g.name === 'Member')
    expect(adminGroup).toBeDefined()
    expect(memberGroup).toBeDefined()

    const alice = members.find((m) => m.email === 'alice@seedco.test')
    const charlie = members.find((m) => m.email === 'charlie@seedco.test')
    expect(alice).toBeDefined()
    expect(charlie).toBeDefined()

    const aliceMask = await getEffectivePermissions('company_seedco_test', alice!.id, 'company', alice!.role)
    const charlieMask = await getEffectivePermissions('company_seedco_test', charlie!.id, 'company', charlie!.role)
    expect(aliceMask).toBe(adminGroup!.bitmask)
    expect(charlieMask).toBe(memberGroup!.bitmask)
  })
})
