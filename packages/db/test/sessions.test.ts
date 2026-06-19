import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createPlatformSession, getPlatformSessionByRefreshToken, revokePlatformSession, countActivePlatformSessions } from '../src/platform'
import { createTenantSession, getActiveTenantSessionByPlatformSessionId, revokeTenantSession, countActiveTenantSessions } from '../src/tenant'
import { createTenantNamespace, removeTenantNamespace } from './helpers.js'

const TEST_NS = `test_sessions_${Date.now()}`

describe('platform sessions', () => {
  it('creates and retrieves a session by refresh token hash', async () => {
    const session = await createPlatformSession('platform', {
      refreshTokenHash: 'platform_hash_1',
      accessTokenJti: 'jti1',
      accountId: 'accounts:test',
      profileId: 'user_profiles:test',
      email: 'test@example.com',
      refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      accessExpiresAt: new Date(Date.now() + 900000).toISOString(),
    })
    const loaded = await getPlatformSessionByRefreshToken('platform', 'platform_hash_1')
    expect(loaded?.id).toBe(session.id)
  })

  it('does not return revoked sessions', async () => {
    const session = await createPlatformSession('platform', {
      refreshTokenHash: 'platform_hash_2',
      accessTokenJti: 'jti2',
      accountId: 'accounts:test',
      profileId: 'user_profiles:test',
      email: 'test@example.com',
      refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      accessExpiresAt: new Date(Date.now() + 900000).toISOString(),
    })
    await revokePlatformSession('platform', session.id)
    const loaded = await getPlatformSessionByRefreshToken('platform', 'platform_hash_2')
    expect(loaded).toBeNull()
  })

  it('counts active sessions by account', async () => {
    await createPlatformSession('platform', {
      refreshTokenHash: 'platform_hash_3',
      accessTokenJti: 'jti3',
      accountId: 'accounts:count',
      profileId: 'user_profiles:count',
      email: 'count@example.com',
      refreshExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      accessExpiresAt: new Date(Date.now() + 900000).toISOString(),
    })
    const count = await countActivePlatformSessions('platform', 'accounts:count')
    expect(count).toBeGreaterThan(0)
  })
})

describe('tenant sessions', () => {
  beforeAll(async () => {
    await createTenantNamespace(TEST_NS)
  })

  afterAll(async () => {
    await removeTenantNamespace(TEST_NS)
  })

  it('creates and retrieves a session by platform session id', async () => {
    const tenantSession = await createTenantSession(TEST_NS, {
      platformSessionId: 'sessions:platform_1',
      memberId: 'members:test',
      profileId: 'user_profiles:test',
      email: 'test@example.com',
      companyId: 'companies:test',
    })
    const loaded = await getActiveTenantSessionByPlatformSessionId(TEST_NS, 'sessions:platform_1', 'companies:test')
    expect(loaded?.id).toBe(tenantSession.id)
  })

  it('does not return revoked sessions', async () => {
    const tenantSession = await createTenantSession(TEST_NS, {
      platformSessionId: 'sessions:platform_2',
      memberId: 'members:test',
      profileId: 'user_profiles:test',
      email: 'test@example.com',
      companyId: 'companies:test',
    })
    await revokeTenantSession(TEST_NS, tenantSession.id)
    const loaded = await getActiveTenantSessionByPlatformSessionId(TEST_NS, 'sessions:platform_2', 'companies:test')
    expect(loaded).toBeNull()
  })

  it('counts active sessions by member', async () => {
    await createTenantSession(TEST_NS, {
      platformSessionId: 'sessions:platform_3',
      memberId: 'members:count',
      profileId: 'user_profiles:count',
      email: 'count@example.com',
      companyId: 'companies:test',
    })
    const count = await countActiveTenantSessions(TEST_NS, 'members:count')
    expect(count).toBeGreaterThan(0)
  })
})
