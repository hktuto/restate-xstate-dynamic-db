import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const SALT_BYTES = 16
const KEYLEN = 32
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1

interface ParsedHash {
  N: number
  r: number
  p: number
  salt: string
  hash: Buffer
}

function parseHash(hashed: string): ParsedHash | null {
  const parts = hashed.split('$')
  if (parts.length !== 5 || parts[1] !== 'scrypt') return null

  const params = new Map<string, number>()
  for (const pair of parts[2]!.split(',')) {
    const [key, value] = pair.split('=') as [string, string]
    const num = Number(value)
    if (!key || value === undefined || !Number.isInteger(num) || num <= 0) return null
    params.set(key, num)
  }

  const N = params.get('N')
  const r = params.get('r')
  const p = params.get('p')
  if (N === undefined || r === undefined || p === undefined) return null

  const hash = Buffer.from(parts[4]!, 'base64')
  if (hash.length === 0) return null

  return { N, r, p, salt: parts[3]!, hash }
}

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString('base64')
  const derived = await scryptAsync(plain, salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  const hash = derived.toString('base64')
  return `$scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt}$${hash}`
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  const parsed = parseHash(hashed)
  if (!parsed) return false

  const { N, r, p, salt, hash } = parsed
  const derived = await scryptAsync(plain, salt, hash.length, {
    N,
    r,
    p,
  })

  if (derived.length !== hash.length) return false
  return timingSafeEqual(derived, hash)
}
