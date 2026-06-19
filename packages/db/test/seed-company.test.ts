import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { seedCompany } from '../scripts/seed-company.js'
import { getCompanyBySlug, getAccountByProviderKey } from '../src/platform.js'
import { getMemberByProfileId } from '../src/tenant.js'
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
  })
})
