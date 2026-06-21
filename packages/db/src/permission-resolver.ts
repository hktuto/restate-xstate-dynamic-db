import type { Surreal } from 'surrealdb'
import { getSurreal, closeSurreal } from './client.js'
import { resourceTypeRecordId } from './resource-types.js'
import { actionValue, allActionsBitmask, bitmaskToActions, hasAction, resourceType, type ResourceType } from 'shared'

const VIEW_BIT = actionValue('platform', 'view')

export interface ResolveOptions {
  recordId?: string
  database?: string
  membershipEdge?: string
  userGroupTable?: string
}

export const TENANT_RESOLVER_OPTS: Required<Pick<ResolveOptions, 'membershipEdge' | 'userGroupTable'>> = {
  membershipEdge: 'user_group_memberships',
  userGroupTable: 'user_groups',
}

export const PLATFORM_RESOLVER_OPTS: Required<Pick<ResolveOptions, 'membershipEdge' | 'userGroupTable'>> = {
  membershipEdge: 'admin_user_group_memberships',
  userGroupTable: 'admin_user_groups',
}

export interface EffectivePermissions {
  bitmask: number
  actions: string[]
}

export interface PermissionSourceBase {
  edgeId: string
  groupId: string
  groupName: string
  bitmask: number
}

export interface DirectPermissionSource extends PermissionSourceBase {
  type: 'direct'
  recordId?: string
}

export interface InheritedPermissionSource extends PermissionSourceBase {
  type: 'inherited'
  propagateMask: number
  fromResourceId: string
  fromResourceName: string
}

export type PermissionSource = DirectPermissionSource | InheritedPermissionSource

export interface ActionPermission {
  action: string
  granted: boolean
  sources: PermissionSource[]
}

export interface MemberResourcePermissions {
  effectiveBitmask: number
  actions: ActionPermission[]
}

export interface PermissionExplanation {
  granted: boolean
  sources: PermissionSource[]
  deniedReason?: string
}

export interface ResourceMember {
  memberId: string
  memberName: string
  effectiveBitmask: number
  actions: string[]
}

interface RawEdge {
  id: string
  groupId: string
  resourceId: string
  groupName: string
  resourceName: string
  bitmask: number
  recordId?: string
  propagateMask?: number
}

function toStringId(value: unknown): string {
  return String(value)
}

function recordScopeCondition(recordId?: string): { sql: string; params: Record<string, unknown> } {
  if (recordId) {
    return {
      sql: 'AND (recordId = $recordId OR recordId IS NONE)',
      params: { recordId },
    }
  }
  return {
    sql: 'AND recordId IS NONE',
    params: {},
  }
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export async function collectAncestors(
  surreal: Surreal,
  resourceId: string
): Promise<string[]> {
  const [result] = await surreal.query<[unknown]>(
    'SELECT VALUE id FROM type::record($resourceId).{..+collect}(->resource_parent->resource_types)',
    { resourceId }
  )
  if (!Array.isArray(result)) return []
  return result.map((id) => toStringId(id)).filter((id) => id && id !== resourceId)
}

interface BatchedEdges {
  directEdges: RawEdge[]
  ancestorEdges: RawEdge[]
}

export async function queryBatchedEdges(
  surreal: Surreal,
  memberId: string,
  resourceId: string,
  ancestorIds: string[],
  opts?: ResolveOptions
): Promise<{ directEdges: RawEdge[]; ancestorEdges: RawEdge[] }> {
  const scope = recordScopeCondition(opts?.recordId)
  const membershipEdge = opts?.membershipEdge ?? TENANT_RESOLVER_OPTS.membershipEdge
  const userGroupTable = opts?.userGroupTable ?? TENANT_RESOLVER_OPTS.userGroupTable

  const query = `
    LET $member = type::record($memberId);
    LET $resource = type::record($resourceId);
    LET $ancestors = array::map($ancestorIds, |$id| type::record($id));
    LET $directViaMember = (
      SELECT id, in AS groupId, in.name AS groupName, out AS resourceId, out.name AS resourceName, bitmask, recordId
      FROM $member->permission_assignments->permission_groups->permission_apply_to
      WHERE out = $resource ${scope.sql}
    );
    LET $directViaUserGroup = (
      SELECT id, in AS groupId, in.name AS groupName, out AS resourceId, out.name AS resourceName, bitmask, recordId
      FROM $member->${membershipEdge}->${userGroupTable}->permission_assignments->permission_groups->permission_apply_to
      WHERE out = $resource ${scope.sql}
    );
    LET $ancestorViaMember = (
      SELECT id, in AS groupId, in.name AS groupName, out AS resourceId, out.name AS resourceName, bitmask, propagateMask
      FROM $member->permission_assignments->permission_groups->permission_apply_to
      WHERE out IN $ancestors AND recordId IS NONE
    );
    LET $ancestorViaUserGroup = (
      SELECT id, in AS groupId, in.name AS groupName, out AS resourceId, out.name AS resourceName, bitmask, propagateMask
      FROM $member->${membershipEdge}->${userGroupTable}->permission_assignments->permission_groups->permission_apply_to
      WHERE out IN $ancestors AND recordId IS NONE
    );
    RETURN {
      directEdges: array::union($directViaMember, $directViaUserGroup),
      ancestorEdges: array::union($ancestorViaMember, $ancestorViaUserGroup)
    };
  `

  const params: Record<string, unknown> = { memberId, resourceId, ancestorIds, ...scope.params }
  const results = await surreal.query<[unknown]>(query, params)
  const last = Array.isArray(results) ? results[results.length - 1] : results
  const payload = (Array.isArray(last) ? last[0] : last) as BatchedEdges | undefined

  const directEdges = (payload?.directEdges ?? []).map((edge) => ({
    ...edge,
    id: toStringId(edge.id),
    groupId: toStringId(edge.groupId),
    resourceId: toStringId(edge.resourceId),
  }))
  const ancestorEdges = (payload?.ancestorEdges ?? []).map((edge) => ({
    ...edge,
    id: toStringId(edge.id),
    groupId: toStringId(edge.groupId),
    resourceId: toStringId(edge.resourceId),
  }))

  return {
    directEdges: uniqueById(directEdges),
    ancestorEdges: uniqueById(ancestorEdges),
  }
}

export function computeMaskFromEdges(
  edges: { directEdges: RawEdge[]; ancestorEdges: RawEdge[] },
  resourceId: string
): number {
  let mask = 0
  for (const edge of edges.directEdges) {
    mask |= edge.bitmask
  }

  const byAncestor = new Map<string, RawEdge[]>()
  for (const edge of edges.ancestorEdges) {
    const ancestorId = edge.resourceId
    if (ancestorId === resourceId) continue
    const list = byAncestor.get(ancestorId) ?? []
    list.push(edge)
    byAncestor.set(ancestorId, list)
  }

  for (const [, list] of byAncestor) {
    const visible = list.some((edge) => (edge.bitmask & VIEW_BIT) !== 0)
    if (!visible) continue
    for (const edge of list) {
      mask |= edge.bitmask & (edge.propagateMask ?? 0)
    }
  }

  return mask
}

export async function getEffectivePermissions(
  namespace: string,
  memberId: string,
  resourceName: ResourceType,
  role?: string,
  recordId?: string,
  opts?: ResolveOptions
): Promise<string> {
  if (role === 'owner') {
    return allActionsBitmask(resourceName)
  }

  const database = opts?.database ?? 'main'
  const surreal = await getSurreal(namespace, database)
  try {
    const resourceId = resourceTypeRecordId(resourceName)
    const ancestors = await collectAncestors(surreal, resourceId)
    const edges = await queryBatchedEdges(surreal, memberId, resourceId, ancestors, {
      ...opts,
      recordId,
    })
    const mask = computeMaskFromEdges(edges, resourceId)
    return mask.toString()
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getMemberResourcePermissions(
  namespace: string,
  memberId: string,
  resourceName: ResourceType,
  opts?: ResolveOptions
): Promise<MemberResourcePermissions> {
  const database = opts?.database ?? 'main'
  const surreal = await getSurreal(namespace, database)
  try {
    const def = resourceType(resourceName)
    const resourceId = resourceTypeRecordId(resourceName)
    const ancestors = await collectAncestors(surreal, resourceId)
    const edges = await queryBatchedEdges(surreal, memberId, resourceId, ancestors, opts)
    const effectiveBitmask = computeMaskFromEdges(edges, resourceId)

    const byAncestor = new Map<string, RawEdge[]>()
    for (const edge of edges.ancestorEdges) {
      if (edge.resourceId === resourceId) continue
      const list = byAncestor.get(edge.resourceId) ?? []
      list.push(edge)
      byAncestor.set(edge.resourceId, list)
    }

    const actions: ActionPermission[] = def.bitMapping.map((entry) => {
      const granted = hasAction(effectiveBitmask, resourceName, entry.name)
      const sources: PermissionSource[] = []
      if (granted) {
        for (const edge of edges.directEdges) {
          if ((edge.bitmask & entry.bit) === entry.bit) {
            sources.push({
              type: 'direct',
              edgeId: edge.id,
              groupId: edge.groupId,
              groupName: edge.groupName,
              bitmask: edge.bitmask,
              recordId: edge.recordId,
            })
          }
        }
        for (const [ancestorId, ancestorEdges] of byAncestor) {
          const visible = ancestorEdges.some((edge) => (edge.bitmask & VIEW_BIT) !== 0)
          if (!visible) continue
          for (const edge of ancestorEdges) {
            const propagateMask = edge.propagateMask ?? 0
            if ((edge.bitmask & propagateMask & entry.bit) === entry.bit) {
              sources.push({
                type: 'inherited',
                edgeId: edge.id,
                groupId: edge.groupId,
                groupName: edge.groupName,
                bitmask: edge.bitmask,
                propagateMask,
                fromResourceId: ancestorId,
                fromResourceName: edge.resourceName,
              })
            }
          }
        }
      }
      return { action: entry.name, granted, sources }
    })

    return { effectiveBitmask, actions }
  } finally {
    await closeSurreal(surreal)
  }
}

export async function batchCheckPermissions(
  namespace: string,
  memberId: string,
  resourceName: ResourceType,
  actions: string[],
  opts?: ResolveOptions
): Promise<Record<string, boolean>> {
  const full = await getMemberResourcePermissions(namespace, memberId, resourceName, opts)
  const result: Record<string, boolean> = {}
  for (const action of actions) {
    const actionPerm = full.actions.find((a) => a.action === action)
    result[action] = actionPerm?.granted ?? false
  }
  return result
}

export async function explainPermission(
  namespace: string,
  memberId: string,
  resourceName: ResourceType,
  action: string,
  opts?: ResolveOptions
): Promise<PermissionExplanation> {
  const def = resourceType(resourceName)
  if (!def.bitMapping.some((b) => b.name === action)) {
    return { granted: false, sources: [], deniedReason: 'unknown action' }
  }
  const full = await getMemberResourcePermissions(namespace, memberId, resourceName, opts)
  const actionPerm = full.actions.find((a) => a.action === action)
  if (!actionPerm?.granted) {
    return { granted: false, sources: [], deniedReason: 'no matching permission grant' }
  }
  return { granted: true, sources: actionPerm.sources }
}

export async function listResourceMembers(
  namespace: string,
  resourceName: ResourceType,
  opts?: ResolveOptions
): Promise<ResourceMember[]> {
  const database = opts?.database ?? 'main'
  const surreal = await getSurreal(namespace, database)
  try {
    const def = resourceType(resourceName)
    const resourceId = resourceTypeRecordId(resourceName)

    // Note: this currently returns only direct assignments (inherited permissions are not included).
    const query = `
      LET $resource = type::record($resourceId);
      LET $groupBitmasks = (
        SELECT in AS groupId, bitmask FROM permission_apply_to WHERE out = $resource
      );
      LET $members = (
        SELECT in AS memberId, in.email AS memberName, array::group(out) AS groupIds
        FROM $resource<-permission_apply_to<-permission_groups<-permission_assignments
        WHERE meta::tb(in) != $userGroupTable
        GROUP BY in
      );
      RETURN { groupBitmasks: $groupBitmasks, members: $members };
    `

    const results = await surreal.query<[unknown]>(query, {
      resourceId,
      userGroupTable: opts?.userGroupTable ?? TENANT_RESOLVER_OPTS.userGroupTable,
    })
    const last = Array.isArray(results) ? results[results.length - 1] : results
    const payload = (Array.isArray(last) ? last[0] : last) as
      | { groupBitmasks: Array<{ groupId: unknown; bitmask: number }>; members: Array<{ memberId: unknown; memberName: string | string[]; groupIds: unknown[] }> }
      | undefined

    const groupMask = new Map<string, number>()
    for (const gb of payload?.groupBitmasks ?? []) {
      groupMask.set(toStringId(gb.groupId), gb.bitmask)
    }

    return (payload?.members ?? []).map((member) => {
      const memberId = toStringId(member.memberId)
      const memberName = Array.isArray(member.memberName)
        ? String(member.memberName[0])
        : String(member.memberName)
      const bitmask = (member.groupIds ?? []).reduce<number>(
        (mask, groupId) => mask | (groupMask.get(toStringId(groupId)) ?? 0),
        0
      )
      return {
        memberId,
        memberName,
        effectiveBitmask: bitmask,
        actions: bitmaskToActions(resourceName, bitmask),
      }
    })
  } finally {
    await closeSurreal(surreal)
  }
}
