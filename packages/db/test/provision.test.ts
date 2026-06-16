import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { provisionCompanyNamespace } from '../src/provision.js'
import { createTenantNamespace, removeTenantNamespace, uniqueTenantName } from './helpers.js'
import { createMember, getMemberById } from '../src/tenant.js'

describe('provisionCompanyNamespace', () => {
  let namespace: string

  beforeEach(async () => {
    namespace = uniqueTenantName()
    await createTenantNamespace(namespace)
  })

  afterEach(async () => {
    await removeTenantNamespace(namespace)
  })

  it('provisions a namespace that supports members', async () => {
    const member = await createMember(namespace, {
      email: 'member@example.com',
      role: 'member',
    })
    expect(member.id).toMatch(/^members:/)

    const found = await getMemberById(namespace, member.id)
    expect(found).toBeDefined()
    expect(found?.email).toBe('member@example.com')
  })
})
