import { getAccountByProviderKey, createAccount, createUserProfile } from 'db/platform'
import { hashPassword } from 'shared'
import { setTenantSession } from '#server/utils/auth'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

const registerAttempts = new Map<string, number[]>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const MAX_RATE_LIMIT_KEYS = 10000

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const attempts = registerAttempts.get(key) ?? []
  const recent = attempts.filter(t => now - t < WINDOW_MS)
  if (recent.length === 0) {
    registerAttempts.delete(key)
  } else {
    registerAttempts.set(key, recent)
  }
  return recent.length >= MAX_ATTEMPTS
}

function recordAttempt(key: string) {
  if (registerAttempts.size >= MAX_RATE_LIMIT_KEYS) {
    const firstKey = registerAttempts.keys().next().value
    if (firstKey !== undefined) {
      registerAttempts.delete(firstKey)
    }
  }
  const attempts = registerAttempts.get(key) ?? []
  attempts.push(Date.now())
  registerAttempts.set(key, attempts)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, name } = body || {}

  if (!email || !password || !name) {
    throw createError({ statusCode: 400, statusMessage: 'Email, password, and name required' })
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

  if (isRateLimited(normalizedEmail)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts' })
  }

  const existing = await getAccountByProviderKey('email', normalizedEmail)
  if (existing) {
    recordAttempt(normalizedEmail)
    throw createError({ statusCode: 409, statusMessage: 'Account already exists' })
  }

  const profile = await createUserProfile({ name: trimmedName })
  const account = await createAccount({
    provider: 'email',
    providerKey: normalizedEmail,
    credential: await hashPassword(password),
    profileId: profile.id
  })

  setTenantSession(event, { accountId: account.id, profileId: profile.id })

  return { ok: true, companies: [] }
})
