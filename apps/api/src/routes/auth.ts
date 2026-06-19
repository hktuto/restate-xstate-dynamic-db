import { Hono } from 'hono'
import { getSurreal, closeSurreal } from 'db/client'
import {
  getAccountByProviderKey,
  getUserProfileById,
  listCompaniesForProfile,
  createAccount,
  createUserProfile,
  getCompanyBySlug,
  createPlatformSession,
  getPlatformSessionById,
  revokePlatformSession,
  updatePlatformSessionToken,
} from 'db/platform'
import {
  getMemberByInviteCode,
  updateMember,
  getMemberByProfileId,
  getActiveTenantSessionByPlatformSessionId,
  createTenantSession,
  revokeTenantSession,
  ensureCompanyPolicy,
  countActiveTenantSessions,
  findOldestActiveTenantSession,
} from 'db/tenant'
import { comparePassword, hashPassword } from 'shared'
import type { Context } from 'hono'
import {
  clearAdminSession,
  clearTenantCompany,
  clearTenantSession,
  createAccessToken,
  createRefreshToken,
  readAdminAccessToken,
  readTenantAccessToken,
  readTenantCompany,
  setAdminSessionCookies,
  setTenantCompany,
  setTenantSessionCookies,
  verifyAccessTokenCookie,
  type TenantCompanyCookie,
} from '../lib/session.js'
import { extractDeviceInfo } from '../lib/device-fingerprint.js'

const DUMMY_HASH = '$2b$12$8V7kAT3IavmTSYAx187I3.xTeRR6Ujz2G1MZACVrUBbN..wVwSICK'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

function createRateLimiter(maxAttempts = 5, windowMs = 15 * 60 * 1000, maxKeys = 10000) {
  const attempts = new Map<string, number[]>()

  function isRateLimited(key: string): boolean {
    const now = Date.now()
    const timestamps = attempts.get(key) ?? []
    const recent = timestamps.filter((t) => now - t < windowMs)
    if (recent.length === 0) {
      attempts.delete(key)
    } else {
      attempts.set(key, recent)
    }
    return recent.length >= maxAttempts
  }

  function recordAttempt(key: string) {
    if (attempts.size >= maxKeys) {
      const firstKey = attempts.keys().next().value
      if (firstKey !== undefined) {
        attempts.delete(firstKey)
      }
    }
    const timestamps = attempts.get(key) ?? []
    timestamps.push(Date.now())
    attempts.set(key, timestamps)
  }

  return { isRateLimited, recordAttempt }
}

const loginAttempts = createRateLimiter()
const registerAttempts = createRateLimiter()
const inviteAttempts = createRateLimiter()

function badRequest(message: string) {
  return { error: message } as const
}

function sevenDaysFromNow(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
}

function fifteenMinutesFromNow(): string {
  return new Date(Date.now() + 15 * 60 * 1000).toISOString()
}

async function startPlatformSession(
  c: Context,
  accountId: string,
  profileId: string,
  email: string,
  opts: { platformUserId?: string; companyId?: string } = {}
) {
  const device = extractDeviceInfo(c)
  const refresh = createRefreshToken()
  const platformSession = await createPlatformSession('platform', {
    refreshTokenHash: refresh.hash,
    accessTokenJti: 'pending',
    accountId: opts.platformUserId ? '' : accountId,
    profileId: opts.platformUserId ? opts.platformUserId : profileId,
    platformUserId: opts.platformUserId,
    email,
    companyId: opts.companyId,
    type: 'user',
    deviceFingerprint: device.fingerprint,
    deviceName: device.name,
    ip: device.ip,
    userAgent: device.userAgent,
    refreshExpiresAt: sevenDaysFromNow(),
    accessExpiresAt: fifteenMinutesFromNow(),
  })
  const access = createAccessToken({
    sessionId: platformSession.id,
    accountId: opts.platformUserId ? opts.platformUserId : accountId,
    profileId: opts.platformUserId ? opts.platformUserId : profileId,
    companyId: opts.companyId,
    type: 'user',
  })
  await updatePlatformSessionToken('platform', platformSession.id, { accessTokenJti: access.jti })
  return { access, refresh, platformSession }
}

async function revokePlatformSessionTree(platformSessionId: string) {
  await revokePlatformSession('platform', platformSessionId)
  // Best-effort: revoke linked tenant sessions across all known company namespaces.
  // In practice a tenant session should be revoked per-company; sweeping all namespaces
  // is left to a future cleanup job. For now we revoke when the company namespace is known.
}

export function authRoutes() {
  const app = new Hono()

  app.post('/login', async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json(badRequest('Invalid JSON'), 400)
    }

    const { email, password } = body
    if (!email || !password) {
      return c.json(badRequest('Email and password required'), 400)
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return c.json(badRequest('Invalid field types'), 400)
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (loginAttempts.isRateLimited(normalizedEmail)) {
      return c.json(badRequest('Too many attempts'), 429)
    }

    const account = await getAccountByProviderKey('email', normalizedEmail)
    const hashToCompare = account?.credential ?? DUMMY_HASH

    if (!(await comparePassword(password, hashToCompare))) {
      loginAttempts.recordAttempt(normalizedEmail)
      return c.json(badRequest('Invalid credentials'), 401)
    }

    if (!account || !account.credential) {
      loginAttempts.recordAttempt(normalizedEmail)
      return c.json(badRequest('Invalid credentials'), 401)
    }

    const profile = await getUserProfileById(account.profileId)
    if (!profile) {
      return c.json(badRequest('Profile not found'), 500)
    }

    const { access, refresh } = await startPlatformSession(c, account.id, profile.id, normalizedEmail)
    setTenantSessionCookies(c, access.token, refresh.token)
    clearTenantCompany(c)

    const companies = await listCompaniesForProfile(profile.id)
    return c.json({ ok: true, companies })
  })

  app.post('/register', async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json(badRequest('Invalid JSON'), 400)
    }

    const { email, password, name } = body
    if (!email || !password || !name) {
      return c.json(badRequest('Email, password, and name required'), 400)
    }
    if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
      return c.json(badRequest('Invalid field types'), 400)
    }

    const normalizedEmail = email.trim().toLowerCase()
    const trimmedName = name.trim()

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return c.json(badRequest('Invalid email'), 400)
    }
    if (trimmedName.length === 0) {
      return c.json(badRequest('Name required'), 400)
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return c.json(badRequest('Password must be at least 8 characters'), 400)
    }

    if (registerAttempts.isRateLimited(normalizedEmail)) {
      return c.json(badRequest('Too many attempts'), 429)
    }

    registerAttempts.recordAttempt(normalizedEmail)

    const existing = await getAccountByProviderKey('email', normalizedEmail)
    if (existing) {
      return c.json(badRequest('Account already exists'), 409)
    }

    const profile = await createUserProfile({ name: trimmedName })
    const account = await createAccount({
      provider: 'email',
      providerKey: normalizedEmail,
      credential: await hashPassword(password),
      profileId: profile.id,
    })

    const { access, refresh } = await startPlatformSession(c, account.id, profile.id, normalizedEmail)
    setTenantSessionCookies(c, access.token, refresh.token)
    clearTenantCompany(c)

    return c.json({ ok: true, companies: [] })
  })

  app.post('/logout', async (c) => {
    const accessToken = readTenantAccessToken(c)
    if (accessToken) {
      const payload = verifyAccessTokenCookie(accessToken)
      if (payload?.sessionId) {
        await revokePlatformSessionTree(payload.sessionId)
      }
    }
    clearTenantSession(c)
    clearTenantCompany(c)
    return c.json({ ok: true })
  })

  app.post('/company', async (c) => {
    const accessToken = readTenantAccessToken(c)
    if (!accessToken) {
      return c.json(badRequest('Unauthorized'), 401)
    }
    const payload = verifyAccessTokenCookie(accessToken)
    if (!payload?.sessionId) {
      return c.json(badRequest('Unauthorized'), 401)
    }

    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json(badRequest('Invalid JSON'), 400)
    }

    const { companyId, slug } = body
    if (!companyId || typeof companyId !== 'string') {
      return c.json(badRequest('companyId required'), 400)
    }
    if (!slug || typeof slug !== 'string') {
      return c.json(badRequest('slug required'), 400)
    }

    const company = await getCompanyBySlug(slug)
    if (!company || company.id !== companyId) {
      return c.json(badRequest('Company not found'), 404)
    }

    const member = await getMemberByProfileId(company.namespace, payload.profileId)
    if (!member || member.status !== 'active') {
      return c.json(badRequest('Forbidden'), 403)
    }

    const existing = await getActiveTenantSessionByPlatformSessionId(company.namespace, payload.sessionId, company.id)
    if (!existing) {
      const policy = await ensureCompanyPolicy(company.namespace, company.id)
      const maxSessions = policy.maxSessions ?? null
      if (maxSessions !== null && maxSessions > 0) {
        const count = await countActiveTenantSessions(company.namespace, member.id)
        if (count >= maxSessions) {
          if (policy.sessionOverflowAction === 'reject') {
            return c.json(badRequest('Maximum active sessions reached'), 403)
          }
          const oldest = await findOldestActiveTenantSession(company.namespace, member.id)
          if (oldest) {
            await revokeTenantSession(company.namespace, oldest.id, 'session_overflow')
          }
        }
      }

      const device = extractDeviceInfo(c)
      await createTenantSession(company.namespace, {
        platformSessionId: payload.sessionId,
        memberId: member.id,
        profileId: payload.profileId,
        email: payload.email ?? member.email,
        companyId: company.id,
        deviceFingerprint: device.fingerprint,
        deviceName: device.name,
        ip: device.ip,
        userAgent: device.userAgent,
      })
    }

    const companyCookie: TenantCompanyCookie = { id: company.id, slug: company.slug, namespace: company.namespace }
    setTenantCompany(c, companyCookie)

    return c.json({ ok: true, company: companyCookie })
  })

  app.post('/accept-invite', async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json(badRequest('Invalid JSON'), 400)
    }

    const { inviteCode, companySlug, email, password, name } = body
    if (!inviteCode || !companySlug || !email || !password || !name) {
      return c.json(badRequest('Missing fields'), 400)
    }
    if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
      return c.json(badRequest('Invalid field types'), 400)
    }

    const normalizedEmail = email.trim().toLowerCase()
    const trimmedName = name.trim()

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return c.json(badRequest('Invalid email'), 400)
    }
    if (trimmedName.length === 0) {
      return c.json(badRequest('Name required'), 400)
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return c.json(badRequest('Password must be at least 8 characters'), 400)
    }

    if (inviteAttempts.isRateLimited(String(inviteCode))) {
      return c.json(badRequest('Too many attempts'), 429)
    }

    const company = await getCompanyBySlug(String(companySlug))
    if (!company) {
      return c.json(badRequest('Company not found'), 400)
    }

    const member = await getMemberByInviteCode(company.namespace, String(inviteCode))
    if (!member || member.status !== 'pending' || member.email !== normalizedEmail) {
      inviteAttempts.recordAttempt(String(inviteCode))
      return c.json(badRequest('Invalid invite'), 400)
    }

    let account = await getAccountByProviderKey('email', normalizedEmail)
    let profileId: string
    let accountId: string

    if (account) {
      if (!account.credential || !(await comparePassword(password, account.credential))) {
        inviteAttempts.recordAttempt(String(inviteCode))
        return c.json(badRequest('Invalid credentials'), 401)
      }
      profileId = account.profileId
      accountId = account.id
    } else {
      const profile = await createUserProfile({ name: trimmedName })
      profileId = profile.id
      account = await createAccount({
        provider: 'email',
        providerKey: normalizedEmail,
        credential: await hashPassword(password),
        profileId,
      })
      accountId = account.id
    }

    const updated = await updateMember(company.namespace, member.id, {
      profileId,
      status: 'active',
      inviteCode: null,
      joinedAt: new Date().toISOString(),
    })
    if (!updated) {
      return c.json(badRequest('Failed to activate member'), 500)
    }

    const { access, refresh, platformSession } = await startPlatformSession(c, accountId, profileId, normalizedEmail)
    setTenantSessionCookies(c, access.token, refresh.token)

    await createTenantSession(company.namespace, {
      platformSessionId: platformSession.id,
      memberId: updated.id,
      profileId,
      email: normalizedEmail,
      companyId: company.id,
    })

    const companyCookie: TenantCompanyCookie = { id: company.id, slug: company.slug, namespace: company.namespace }
    setTenantCompany(c, companyCookie)

    return c.json({ ok: true, member: updated })
  })

  app.post('/admin/login', async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return c.json(badRequest('Invalid JSON'), 400)
    }

    const { email, password } = body
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return c.json(badRequest('Email and password required'), 400)
    }

    const surreal = await getSurreal('platform', 'admin')
    try {
      const [users] = await surreal.query<[AdminUser[]]>(
        'SELECT * FROM platform_users WHERE email = $email LIMIT 1',
        { email }
      )
      const user = users[0]
      if (!user || !(await comparePassword(password, user.password))) {
        return c.json(badRequest('Invalid credentials'), 401)
      }
      const { access, refresh } = await startPlatformSession(c, user.id, user.id, user.email, { platformUserId: user.id })
      setAdminSessionCookies(c, access.token, refresh.token)
      return c.json({ ok: true })
    } finally {
      await closeSurreal(surreal)
    }
  })

  app.post('/admin/logout', async (c) => {
    const accessToken = readAdminAccessToken(c)
    if (accessToken) {
      const payload = verifyAccessTokenCookie(accessToken)
      if (payload?.sessionId) {
        await revokePlatformSession('platform', payload.sessionId)
      }
    }
    clearAdminSession(c)
    return c.json({ ok: true })
  })

  app.get('/admin/me', (c) => {
    const accessToken = readAdminAccessToken(c)
    if (!accessToken) {
      return c.json({ authenticated: false, user: null })
    }
    const payload = verifyAccessTokenCookie(accessToken)
    if (!payload) {
      return c.json({ authenticated: false, user: null })
    }
    return c.json({ authenticated: true, user: { userId: payload.accountId, email: payload.email } })
  })

  return app
}

interface AdminUser {
  id: string
  email: string
  password: string
}
