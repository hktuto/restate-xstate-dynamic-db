import {
  getPlatformSessionByRefreshToken,
  updatePlatformSessionToken,
  revokePlatformSession,
} from 'db/platform'
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  type TenantSession,
  type AdminSession,
} from './session.js'

export type RefreshSessionRole = 'user' | 'admin'

export interface RefreshResult {
  accessToken: string
  refreshToken: string
  session: TenantSession | AdminSession
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function computeRefreshExpiresAt(): string {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString()
}

export async function refreshSession(
  namespace: string,
  refreshToken: string,
  role: RefreshSessionRole = 'user'
): Promise<RefreshResult | null> {
  const hash = hashRefreshToken(refreshToken)
  const record = await getPlatformSessionByRefreshToken(namespace, hash)
  if (!record) return null

  if (role === 'admin') {
    if (!record.platformUserId || !record.email) {
      await revokePlatformSession(namespace, record.id, 'incomplete_session')
      return null
    }
  } else {
    if (!record.accountId || !record.profileId || !record.email) {
      await revokePlatformSession(namespace, record.id, 'incomplete_session')
      return null
    }
  }

  const newRefresh = createRefreshToken()
  const access = createAccessToken({
    sessionId: record.id,
    accountId: role === 'admin' ? record.platformUserId! : record.accountId!,
    profileId: role === 'admin' ? record.platformUserId! : record.profileId!,
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

  const session: TenantSession | AdminSession =
    role === 'admin'
      ? {
          sessionId: record.id,
          userId: record.platformUserId!,
          email: record.email!,
        }
      : {
          sessionId: record.id,
          accountId: record.accountId!,
          profileId: record.profileId!,
          companyId: record.companyId,
          type: record.type!,
          impersonatorId: record.impersonatorId,
        }

  return {
    accessToken: access.token,
    refreshToken: newRefresh.token,
    session,
  }
}
