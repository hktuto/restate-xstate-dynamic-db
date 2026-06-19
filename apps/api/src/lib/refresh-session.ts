import {
  getTenantSessionByRefreshToken,
  updateTenantSessionToken,
  revokeTenantSession,
} from 'db/tenant'
import {
  getPlatformSessionByRefreshToken,
  updatePlatformSessionToken,
  revokePlatformSession,
} from 'db/platform'
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  setTenantSessionCookies,
  setAdminSessionCookies,
  type TenantSession,
  type AdminSession,
} from './session.js'

export interface RefreshResult {
  accessToken: string
  refreshToken: string
  session: TenantSession | AdminSession
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function computeRefreshExpiresAt(): string {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString()
}

export async function refreshTenantSession(namespace: string, refreshToken: string): Promise<RefreshResult | null> {
  const hash = hashRefreshToken(refreshToken)
  const record = await getTenantSessionByRefreshToken(namespace, hash)
  if (!record) return null

  // Note: refresh-token reuse detection is deferred until a token-family design is implemented.

  const newRefresh = createRefreshToken()
  const access = createAccessToken({
    sessionId: record.id,
    accountId: record.profileId, // tenant sessions do not have accountId; use profileId
    profileId: record.profileId,
    companyId: record.companyId,
    type: record.type,
    impersonatorId: record.impersonatorId,
  })

  await updateTenantSessionToken(namespace, record.id, {
    refreshTokenHash: newRefresh.hash,
    refreshExpiresAt: computeRefreshExpiresAt(),
    accessTokenJti: access.jti,
    accessExpiresAt: access.expiresAt.toISOString(),
  })

  return {
    accessToken: access.token,
    refreshToken: newRefresh.token,
    session: {
      sessionId: record.id,
      accountId: record.profileId,
      profileId: record.profileId,
      companyId: record.companyId,
      type: record.type,
      impersonatorId: record.impersonatorId,
    },
  }
}

export async function refreshAdminSession(namespace: string, refreshToken: string): Promise<RefreshResult | null> {
  const hash = hashRefreshToken(refreshToken)
  const record = await getPlatformSessionByRefreshToken(namespace, hash)
  if (!record) return null

  if (!record.platformUserId || !record.email) {
    await revokePlatformSession(namespace, record.id, 'incomplete_session')
    return null
  }

  const newRefresh = createRefreshToken()
  const access = createAccessToken({
    sessionId: record.id,
    accountId: record.platformUserId,
    profileId: record.platformUserId,
    companyId: record.companyId,
    type: record.type,
    impersonatorId: record.impersonatorId,
  })

  await updatePlatformSessionToken(namespace, record.id, {
    refreshTokenHash: newRefresh.hash,
    refreshExpiresAt: computeRefreshExpiresAt(),
    accessTokenJti: access.jti,
    accessExpiresAt: access.expiresAt.toISOString(),
  })

  return {
    accessToken: access.token,
    refreshToken: newRefresh.token,
    session: {
      sessionId: record.id,
      userId: record.platformUserId,
      email: record.email,
    },
  }
}
