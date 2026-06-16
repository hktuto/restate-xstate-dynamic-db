import { getMemberByInviteCode, updateMember } from 'db/tenant'
import { getAccountByProviderKey, createAccount, createUserProfile, getCompanyBySlug } from 'db/platform'
import { hashPassword, comparePassword } from 'shared'
import { setTenantSession, setTenantCompany } from '#server/utils/auth'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

const inviteAttempts = new Map<string, number[]>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const MAX_RATE_LIMIT_KEYS = 10000

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const attempts = inviteAttempts.get(key) ?? []
  const recent = attempts.filter(t => now - t < WINDOW_MS)
  if (recent.length === 0) {
    inviteAttempts.delete(key)
  } else {
    inviteAttempts.set(key, recent)
  }
  return recent.length >= MAX_ATTEMPTS
}

function recordAttempt(key: string) {
  if (inviteAttempts.size >= MAX_RATE_LIMIT_KEYS) {
    const firstKey = inviteAttempts.keys().next().value
    if (firstKey !== undefined) {
      inviteAttempts.delete(firstKey)
    }
  }
  const attempts = inviteAttempts.get(key) ?? []
  attempts.push(Date.now())
  inviteAttempts.set(key, attempts)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { inviteCode, companySlug, email, password, name } = body || {}

  if (!inviteCode || !companySlug || !email || !password || !name) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fields' })
  }

  if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid field types' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const trimmedName = name.trim()

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  }

  if (trimmedName.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Name required' })
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }

  if (isRateLimited(inviteCode)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts' })
  }

  const company = await getCompanyBySlug(companySlug)
  if (!company) {
    throw createError({ statusCode: 400, statusMessage: 'Company not found' })
  }

  const member = await getMemberByInviteCode(company.namespace, inviteCode)
  if (!member || member.status !== 'pending' || member.email !== normalizedEmail) {
    recordAttempt(inviteCode)
    throw createError({ statusCode: 400, statusMessage: 'Invalid invite' })
  }

  let account = await getAccountByProviderKey('email', normalizedEmail)
  let profileId: string

  if (account) {
    if (!account.credential || !(await comparePassword(password, account.credential))) {
      recordAttempt(inviteCode)
      throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
    }
    profileId = account.profileId
  } else {
    const profile = await createUserProfile({ name: trimmedName })
    profileId = profile.id
    account = await createAccount({
      provider: 'email',
      providerKey: normalizedEmail,
      credential: await hashPassword(password),
      profileId
    })
  }

  const updated = await updateMember(company.namespace, member.id, {
    profileId,
    status: 'active',
    inviteCode: null,
    joinedAt: new Date().toISOString()
  })

  setTenantSession(event, { accountId: account.id, profileId })
  setTenantCompany(event, { id: company.id, slug: company.slug, namespace: company.namespace })

  return { ok: true, member: updated }
})
