import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { provisionCompanyNamespace } from '../src/provision.js'
import { removeTenantNamespace, uniqueTenantName } from './helpers.js'
import { createMember, getMemberById } from '../src/tenant.js'

describe('provisionCompanyNamespace', () => {
  let namespace: string

  beforeEach(() => {
    namespace = uniqueTenantName()
  })

  afterEach(async () => {
    await removeTenantNamespace(namespace)
  })

  it('provisions a namespace that supports members', async () => {
    const result = await provisionCompanyNamespace(namespace)
    expect(result.ok).toBe(true)
    expect(result.namespace).toBe(namespace)

    const member = await createMember(namespace, {
      email: 'member@example.com',
      role: 'member',
    })
    expect(member.id).toMatch(/^members:/)

    const found = await getMemberById(namespace, member.id)
    expect(found).toBeDefined()
    expect(found?.email).toBe('member@example.com')
  })

  it('rejects invalid namespace names', async () => {
    await expect(provisionCompanyNamespace('invalid-name')).rejects.toThrow()
  })
})
