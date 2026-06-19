import { createHmac, timingSafeEqual } from 'node:crypto'

const SEPARATOR = '.'

function computeSignature(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function sign(value: string, secret: string): string {
  return `${computeSignature(value, secret)}${SEPARATOR}${value}`
}

export function unsign(signedValue: string, secret: string): string | null {
  const index = signedValue.indexOf(SEPARATOR)
  if (index === -1) return null
  const signature = signedValue.slice(0, index)
  const value = signedValue.slice(index + 1)
  const expected = computeSignature(value, secret)
  if (signature.length !== expected.length) return null
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? value : null
}

export function signObject<T extends object>(obj: T, secret: string): string {
  return sign(JSON.stringify(obj), secret)
}

export function unsignObject<T extends object>(signedValue: string, secret: string): T | null {
  const value = unsign(signedValue, secret)
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as T
  } catch {
    return null
  }
}

export interface AccessTokenPayload {
  sessionId: string
  accountId: string
  profileId: string
  email?: string
  companyId?: string
  type: 'user' | 'impersonation'
  impersonatorId?: string
  jti: string
  exp: number
  iat: number
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isAccessTokenPayload(obj: unknown): obj is AccessTokenPayload {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return false
  }
  const payload = obj as Record<string, unknown>
  if (typeof payload.sessionId !== 'string') return false
  if (typeof payload.accountId !== 'string') return false
  if (typeof payload.profileId !== 'string') return false
  if (typeof payload.jti !== 'string') return false
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return false
  if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat)) return false
  if (payload.type !== 'user' && payload.type !== 'impersonation') return false
  if (!isOptionalString(payload.email)) return false
  if (!isOptionalString(payload.companyId)) return false
  if (!isOptionalString(payload.impersonatorId)) return false
  return true
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat'>, secret: string): string {
  return signObject({ ...payload, iat: Date.now() }, secret)
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload | null {
  const obj = unsignObject<AccessTokenPayload>(token, secret)
  if (!obj) return null
  if (!isAccessTokenPayload(obj)) return null
  if (obj.exp < Date.now()) return null
  return obj
}
