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
