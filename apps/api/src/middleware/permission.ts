import { createMiddleware } from 'hono/factory'
import { getEffectivePermissions } from 'db/permissions'
import { PLATFORM_RESOLVER_OPTS } from 'db'
import { hasAction, type ResourceType, type PermissionAction } from 'shared'
import type { TenantScope, AdminScope, ApiScope } from '../types.js'

function requireScopePermission<T extends ResourceType>(
  scopeType: 'tenant' | 'admin',
  resourceType: T,
  action: PermissionAction<T>,
  recordIdParam?: string
) {
  return createMiddleware(async (c, next) => {
    const scope = c.get('scope') as ApiScope | undefined
    if (!scope || scope.type !== scopeType) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    if (scope.type === 'tenant' && scope.role === 'owner') {
      return next()
    }

    const recordId = recordIdParam ? c.req.param(recordIdParam) : undefined
    const mask = await resolveEffectivePermissions(scope, resourceType, recordId)
    if (!hasAction(mask, resourceType, action)) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await next()
  })
}

async function resolveEffectivePermissions(
  scope: TenantScope | AdminScope,
  resourceType: ResourceType,
  recordId?: string
): Promise<string> {
  scope.permissions ??= {}
  const key = recordId ? `${resourceType}:${recordId}` : resourceType
  if (scope.permissions[key]) {
    return scope.permissions[key]
  }
  const resolverOpts = scope.type === 'admin'
    ? { ...PLATFORM_RESOLVER_OPTS, database: scope.database }
    : undefined
  const mask = await getEffectivePermissions(
    scope.namespace,
    scope.type === 'tenant' ? scope.memberId : scope.userId,
    resourceType,
    scope.type === 'tenant' ? scope.role : undefined,
    recordId,
    resolverOpts
  )
  scope.permissions[key] = mask
  return mask
}

export function requirePermission<T extends ResourceType>(
  resourceType: T,
  action: PermissionAction<T>,
  recordIdParam?: string
) {
  return requireScopePermission('tenant', resourceType, action, recordIdParam)
}

export function requireAdminPermission<T extends ResourceType>(
  resourceType: T,
  action: PermissionAction<T>,
  recordIdParam?: string
) {
  return requireScopePermission('admin', resourceType, action, recordIdParam)
}

export async function resolvePermissions(
  scope: TenantScope,
  resourceType: ResourceType,
  recordId?: string
): Promise<string> {
  return resolveEffectivePermissions(scope, resourceType, recordId)
}

export async function resolveAdminPermissions(
  scope: AdminScope,
  resourceType: ResourceType,
  recordId?: string
): Promise<string> {
  return resolveEffectivePermissions(scope, resourceType, recordId)
}
