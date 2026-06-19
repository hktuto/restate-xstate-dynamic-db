import { describe, it, expect } from 'vitest'
import type { Context } from 'hono'
import { extractDeviceInfo, type DeviceInfo } from './device-fingerprint.js'

function mockContext(headers: Record<string, string>): Context {
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()]
    }
  } as unknown as Context
}

describe('extractDeviceInfo', () => {
  it('returns the same fingerprint for identical inputs', () => {
    const headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.0',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua-platform': '"Windows"',
      'x-device-id': 'device-1'
    }
    const a = extractDeviceInfo(mockContext(headers))
    const b = extractDeviceInfo(mockContext(headers))
    expect(a.fingerprint).toBe(b.fingerprint)
  })

  it('returns different fingerprints for different inputs', () => {
    const base = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.0',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua-platform': '"Windows"',
      'x-device-id': 'device-1'
    }
    const a = extractDeviceInfo(mockContext(base))
    const b = extractDeviceInfo(mockContext({ ...base, 'x-device-id': 'device-2' }))
    expect(a.fingerprint).not.toBe(b.fingerprint)
  })

  it('parses iPhone user agent as iOS', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    const info = extractDeviceInfo(mockContext({ 'user-agent': ua }))
    expect(info.name).toBe('Safari on iOS')
  })

  it('parses iPad user agent as iOS', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    const info = extractDeviceInfo(mockContext({ 'user-agent': ua }))
    expect(info.name).toBe('Safari on iOS')
  })

  it('parses modern Edge user agent as Edge', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    const info = extractDeviceInfo(mockContext({ 'user-agent': ua }))
    expect(info.name).toBe('Edge on Windows')
  })

  it('parses Android user agent as Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    const info = extractDeviceInfo(mockContext({ 'user-agent': ua }))
    expect(info.name).toBe('Chrome on Android')
  })

  it('defaults to unknown when headers are missing', () => {
    const info = extractDeviceInfo(mockContext({}))
    expect(info.userAgent).toBe('unknown')
    expect(info.ip).toBe('unknown')
    expect(info.name).toBe('Browser on Unknown')
    expect(info.fingerprint).toBeDefined()
  })

  it('uses the first IP from X-Forwarded-For', () => {
    const info = extractDeviceInfo(mockContext({
      'x-forwarded-for': '203.0.113.1, 198.51.100.2',
      'x-real-ip': '198.51.100.3'
    }))
    expect(info.ip).toBe('203.0.113.1')
  })

  it('falls back to X-Real-IP when X-Forwarded-For is absent', () => {
    const info = extractDeviceInfo(mockContext({
      'x-real-ip': '198.51.100.3'
    }))
    expect(info.ip).toBe('198.51.100.3')
  })
})
