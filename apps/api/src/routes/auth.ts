import { Hono } from 'hono'
import { getSurreal, closeSurreal } from 'db/client'
import {
  getAccountByProviderKey,
  getUserProfileById,
  listCompaniesForProfile,
  createAccount,
  createUserProfile,
  getCompanyBySlug,
} from 'db/platform'
import { getMemberByInviteCode, updateMember } from 'db/tenant'
import { comparePassword, hashPassword } from 'shared'
import {
  clearAdminSession,
  clearTenantCompany,
  clearTenantSession,
  readAdminSession,
  setAdminSession,
  setTenantCompany,
  setTenantSession,
} from '../lib/session.js'
import type { AdminSession } from '../lib/session.js'

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

    setTenantSession(c, { accountId: account.id, profileId: profile.id })
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

    setTenantSession(c, { accountId: account.id, profileId: profile.id })

    return c.json({ ok: true, companies: [] })
  })

  app.post('/logout', async (c) => {
    clearTenantSession(c)
    clearTenantCompany(c)
    return c.json({ ok: true })
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

    if (account) {
      if (!account.credential || !(await comparePassword(password, account.credential))) {
        inviteAttempts.recordAttempt(String(inviteCode))
        return c.json(badRequest('Invalid credentials'), 401)
      }
      profileId = account.profileId
    } else {
      const profile = await createUserProfile({ name: trimmedName })
      profileId = profile.id
      account = await createAccount({
        provider: 'email',
        providerKey: normalizedEmail,
        credential: await hashPassword(password),
        profileId,
      })
    }

    const updated = await updateMember(company.namespace, member.id, {
      profileId,
      status: 'active',
      inviteCode: null,
      joinedAt: new Date().toISOString(),
    })

    setTenantSession(c, { accountId: account.id, profileId })
    setTenantCompany(c, { id: company.id, slug: company.slug, namespace: company.namespace })

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
      setAdminSession(c, { userId: user.id, email: user.email })
      return c.json({ ok: true })
    } finally {
      await closeSurreal(surreal)
    }
  })

  app.post('/admin/logout', (c) => {
    clearAdminSession(c)
    return c.json({ ok: true })
  })

  app.get('/admin/me', (c) => {
    const session = readAdminSession(c)
    return c.json({ authenticated: !!session, user: session })
  })

  return app
}

interface AdminUser {
  id: string
  email: string
  password: string
}
