import { createMiddleware } from 'hono/factory'
import { getEffectivePermissions } from 'db/permissions'
import { PLATFORM_RESOLVER_OPTS } from 'db'
import { hasAction, type ResourceType, type PermissionAction } from 'shared'
import type { AdminScope } from '../types.js'

export function requireAdminPermission<T extends ResourceType>(
  resourceType: T,
  action: PermissionAction<T>,
  recordIdParam?: string
) {
  return createMiddleware(async (c, next) => {
    const scope = c.get('scope') as AdminScope | undefined
    if (!scope || scope.type !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const recordId = recordIdParam ? c.req.param(recordIdParam) : undefined
    const mask = await resolveAdminPermissions(scope, resourceType, recordId)
    if (!hasAction(mask, resourceType, action)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await next()
  })
}

export async function resolveAdminPermissions(
  scope: AdminScope,
  resourceType: ResourceType,
  recordId?: string
): Promise<string> {
  scope.permissions ??= {}
  const key = recordId ? `${resourceType}:${recordId}` : resourceType
  if (scope.permissions[key]) {
    return scope.permissions[key]!
  }
  const mask = await getEffectivePermissions(
    scope.namespace,
    scope.userId,
    resourceType,
    undefined,
    recordId,
    { ...PLATFORM_RESOLVER_OPTS, database: scope.database }
  )
  scope.permissions[key] = mask
  return mask
}
