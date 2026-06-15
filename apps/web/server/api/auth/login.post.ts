import { getAccountByProviderKey, getUserProfileById, getCompanyBySlug } from 'db/platform'
import { getMemberByProfileId } from 'db/tenant'
import { comparePassword } from 'shared'
import { setTenantSession } from '#server/utils/auth'

const DUMMY_HASH = '$2b$12$8V7kAT3IavmTSYAx187I3.xTeRR6Ujz2G1MZACVrUBbN..wVwSICK'

const loginAttempts = new Map<string, number[]>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const attempts = loginAttempts.get(key) ?? []
  const recent = attempts.filter(t => now - t < WINDOW_MS)
  if (recent.length === 0) {
    loginAttempts.delete(key)
  } else {
    loginAttempts.set(key, recent)
  }
  return recent.length >= MAX_ATTEMPTS
}

function recordAttempt(key: string) {
  const attempts = loginAttempts.get(key) ?? []
  attempts.push(Date.now())
  loginAttempts.set(key, attempts)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, companySlug } = body || {}
  const normalizedEmail = email?.trim().toLowerCase()

  if (!normalizedEmail || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password required' })
  }

  if (isRateLimited(normalizedEmail)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts' })
  }

  const account = await getAccountByProviderKey('email', normalizedEmail)
  const hashToCompare = account?.credential ?? DUMMY_HASH

  if (!(await comparePassword(password, hashToCompare))) {
    recordAttempt(normalizedEmail)
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  if (!account || !account.credential) {
    recordAttempt(normalizedEmail)
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const profile = await getUserProfileById(account.profileId)
  if (!profile) {
    throw createError({ statusCode: 500, statusMessage: 'Profile not found' })
  }

  let company = event.context.company
  if (!company && companySlug) {
    const companyRecord = await getCompanyBySlug(companySlug)
    if (!companyRecord) {
      throw createError({ statusCode: 400, statusMessage: 'Company not found' })
    }
    company = {
      id: companyRecord.id,
      slug: companyRecord.slug,
      namespace: companyRecord.namespace
    }
  }

  if (!company) {
    throw createError({ statusCode: 400, statusMessage: 'Company not resolved' })
  }

  const member = await getMemberByProfileId(company.namespace, profile.id)
  if (!member || member.status !== 'active') {
    throw createError({ statusCode: 403, statusMessage: 'Not a member of this company' })
  }

  setTenantSession(event, {
    accountId: account.id,
    profileId: profile.id,
    companyId: company.id,
    memberId: member.id,
    role: member.role
  })

  return { ok: true }
})
