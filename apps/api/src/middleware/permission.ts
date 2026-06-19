import { createMiddleware } from 'hono/factory'
import { getEffectivePermissions } from 'db/permissions'
import { hasAction, type ResourceType, type PermissionAction } from 'shared'
import type { TenantScope } from '../types.js'

export function requirePermission<T extends ResourceType>(
  resourceType: T,
  action: PermissionAction<T>,
  recordIdParam?: string
) {
  return createMiddleware(async (c, next) => {
    const scope = c.get('scope') as TenantScope | undefined
    if (!scope || scope.type !== 'tenant') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    if (scope.role === 'owner') {
      return next()
    }

    const recordId = recordIdParam ? c.req.param(recordIdParam) : undefined
    const mask = await resolvePermissions(scope, resourceType, recordId)
    if (!hasAction(mask, resourceType, action)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await next()
  })
}

async function resolvePermissions(
  scope: TenantScope,
  resourceType: ResourceType,
  recordId?: string
): Promise<string> {
  scope.permissions ??= {}
  const key = recordId ? `${resourceType}:${recordId}` : resourceType
  if (scope.permissions[key]) {
    return scope.permissions[key]
  }
  const mask = await getEffectivePermissions(
    scope.namespace,
    scope.memberId,
    resourceType,
    scope.role,
    recordId
  )
  scope.permissions[key] = mask
  return mask
}
