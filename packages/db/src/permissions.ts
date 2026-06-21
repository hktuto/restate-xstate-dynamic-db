import { StringRecordId } from 'surrealdb'
import { defaultGroups, type ResourceType } from 'shared'
import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import { resourceTypeRecordId } from './resource-types.js'

export {
  getEffectivePermissions,
  getMemberResourcePermissions,
  batchCheckPermissions,
  explainPermission,
  listResourceMembers,
} from './permission-resolver.js'

export interface PermissionGroupRecord {
  id: string
  resourceType: string
  recordId?: string
  name: string
  isSystem: boolean
  description?: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface PermissionGroupInput {
  resourceType: string
  recordId?: string
  name: string
  isSystem?: boolean
  description?: string
}

export async function createPermissionGroup(
  namespace: string,
  database: string,
  input: PermissionGroupInput
): Promise<PermissionGroupRecord> {
  const surreal = await getSurreal(namespace, database)
  try {
    const now = new Date().toISOString()
    const data = {
      ...input,
      isSystem: input.isSystem ?? false,
      createdAt: now,
      updatedAt: now,
    }
    const [created] = await surreal.query<[PermissionGroupRecord[]]>(
      'CREATE permission_groups CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listPermissionGroups(
  namespace: string,
  database: string,
  resourceType: string,
  recordId?: string
): Promise<PermissionGroupRecord[]> {
  const surreal = await getSurreal(namespace, database)
  try {
    const query = recordId
      ? 'SELECT * FROM permission_groups WHERE resourceType = $resourceType AND recordId = $recordId ORDER BY createdAt'
      : 'SELECT * FROM permission_groups WHERE resourceType = $resourceType AND recordId IS NONE ORDER BY createdAt'
    const [groups] = await surreal.query<[PermissionGroupRecord[]]>(query, { resourceType, recordId })
    return normalizeIds(groups)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getPermissionGroupById(
  namespace: string,
  database: string,
  id: string
): Promise<PermissionGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, database)
  try {
    const [result] = await surreal.query<[PermissionGroupRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updatePermissionGroup(
  namespace: string,
  database: string,
  id: string,
  input: Partial<PermissionGroupInput>
): Promise<PermissionGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, database)
  try {
    const data = { ...input, updatedAt: new Date().toISOString() }
    const [updated] = await surreal.query<[PermissionGroupRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deletePermissionGroup(namespace: string, database: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, database)
  try {
    await surreal.query('DELETE permission_assignments WHERE out = type::record($id)', { id })
    await surreal.query('DELETE permission_apply_to WHERE in = type::record($id)', { id })
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export async function assignPermissionGroup(
  namespace: string,
  database: string,
  assigneeId: string,
  groupId: string
): Promise<void> {
  const group = await getPermissionGroupById(namespace, database, groupId)
  if (!group) throw new Error(`Permission group not found: ${groupId}`)

  const surreal = await getSurreal(namespace, database)
  try {
    await surreal.query(
      'RELATE $assigneeId->permission_assignments->$groupId SET resourceType = $resourceType, recordId = $recordId',
      {
        assigneeId: new StringRecordId(assigneeId),
        groupId: new StringRecordId(groupId),
        resourceType: group.resourceType,
        recordId: group.recordId ?? null,
      }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function removePermissionGroup(
  namespace: string,
  database: string,
  assigneeId: string,
  groupId: string
): Promise<void> {
  const surreal = await getSurreal(namespace, database)
  try {
    await surreal.query(
      'DELETE permission_assignments WHERE in = type::record($assigneeId) AND out = type::record($groupId)',
      { assigneeId, groupId }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listPermissionAssignments(
  namespace: string,
  database: string,
  assigneeId: string
): Promise<PermissionGroupRecord[]> {
  const surreal = await getSurreal(namespace, database)
  try {
    const [rows] = await surreal.query<
      [Array<{ out: PermissionGroupRecord }>]
    >(
      'SELECT out.* AS out FROM permission_assignments WHERE in = type::record($assigneeId)',
      { assigneeId }
    )
    return normalizeIds(rows.map((r) => r.out))
  } finally {
    await closeSurreal(surreal)
  }
}

export interface ApplyPermissionInput {
  groupId: string
  resourceType: string
  bitmask: number
  propagateMask?: number
  recordId?: string
  conditions?: Record<string, unknown>
}

export async function applyPermissionToResource(
  namespace: string,
  database: string,
  input: ApplyPermissionInput
): Promise<void> {
  const { groupId, resourceType: resourceName, bitmask, propagateMask = 0, recordId, conditions } = input
  const surreal = await getSurreal(namespace, database)
  try {
    const resourceId = resourceTypeRecordId(resourceName)
    const data: Record<string, unknown> = { bitmask, propagateMask }
    if (recordId) data.recordId = recordId
    if (conditions) data.conditions = conditions
    await surreal.query(
      'RELATE $groupId->permission_apply_to->$resourceId CONTENT $data',
      {
        groupId: new StringRecordId(groupId),
        resourceId: new StringRecordId(resourceId),
        data,
      }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function provisionDefaultCompanyGroups(
  namespace: string,
  ownerMemberId: string
): Promise<void> {
  for (const resourceName of ['tenant', 'member'] as ResourceType[]) {
    const groups = defaultGroups(resourceName)
    for (const groupDef of groups) {
      const group = await createPermissionGroup(namespace, 'main', {
        resourceType: resourceName,
        name: groupDef.name,
        isSystem: true,
      })
      await applyPermissionToResource(namespace, 'main', {
        groupId: group.id,
        resourceType: resourceName,
        bitmask: groupDef.bitmask,
        propagateMask: groupDef.propagateMask,
      })
      if (groupDef.name === 'owner') {
        await assignPermissionGroup(namespace, 'main', ownerMemberId, group.id)
      }
    }
  }
}
