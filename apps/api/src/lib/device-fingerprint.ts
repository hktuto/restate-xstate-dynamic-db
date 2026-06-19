import type { Context } from 'hono'
import { createHash } from 'node:crypto'

export interface DeviceInfo {
  fingerprint: string
  name: string
  userAgent: string
  ip: string
}

export function extractDeviceInfo(c: Context): DeviceInfo {
  const userAgent = c.req.header('user-agent') ?? 'unknown'
  const acceptLanguage = c.req.header('accept-language') ?? ''
  const platform = c.req.header('sec-ch-ua-platform') ?? ''
  const clientDeviceId = c.req.header('x-device-id') ?? ''
  const ip = getClientIP(c) ?? 'unknown'

  const fingerprint = createHash('sha256')
    .update(JSON.stringify([userAgent.trim(), acceptLanguage.trim(), platform.trim(), clientDeviceId.trim()]))
    .digest('hex')

  const name = deriveDeviceName(userAgent)

  return { fingerprint, name, userAgent, ip }
}

function deriveDeviceName(userAgent: string): string {
  const browser = parseBrowser(userAgent)
  const os = parseOS(userAgent)
  return `${browser} on ${os}`
}

function parseBrowser(ua: string): string {
  if (ua.includes('Edg/') || ua.includes('EdgA/') || ua.includes('Edge/')) return 'Edge'
  if (ua.includes('Chrome/')) return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari'
  return 'Browser'
}

function parseOS(ua: string): string {
  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) return 'iOS'
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac OS')) return 'macOS'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('Linux')) return 'Linux'
  return 'Unknown'
}

function getClientIP(c: Context): string | undefined {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim()
  return c.req.header('x-real-ip')
}
