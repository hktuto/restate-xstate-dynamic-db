import { StringRecordId } from 'surrealdb'
import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import { actionsToBitmask, allActionsBitmask, type ResourceType } from 'shared'

export interface PermissionGroupRecord {
  id: string
  resourceType: string
  recordId?: string
  name: string
  bitmask: string
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
  bitmask: string
  isSystem?: boolean
  description?: string
}

export async function createPermissionGroup(
  namespace: string,
  input: PermissionGroupInput
): Promise<PermissionGroupRecord> {
  const surreal = await getSurreal(namespace, 'main')
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
  resourceType: string,
  recordId?: string
): Promise<PermissionGroupRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
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
  id: string
): Promise<PermissionGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
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
  id: string,
  input: Partial<PermissionGroupInput>
): Promise<PermissionGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
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

export async function deletePermissionGroup(namespace: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query('DELETE type::record($id)', { id })
    await surreal.query('DELETE permission_assignments WHERE out = type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export async function assignPermissionGroup(
  namespace: string,
  assigneeId: string,
  groupId: string
): Promise<void> {
  const group = await getPermissionGroupById(namespace, groupId)
  if (!group) throw new Error(`Permission group not found: ${groupId}`)

  const surreal = await getSurreal(namespace, 'main')
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
  assigneeId: string,
  groupId: string
): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
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
  assigneeId: string
): Promise<PermissionGroupRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<
      Array<{ out: PermissionGroupRecord }>
    >(
      'SELECT out.* AS out FROM permission_assignments WHERE in = type::record($assigneeId)',
      { assigneeId }
    )
    return normalizeIds(rows.map((r) => r.out))
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getEffectivePermissions(
  namespace: string,
  memberId: string,
  resourceType: ResourceType,
  role?: string,
  recordId?: string
): Promise<string> {
  if (role === 'owner') {
    return allActionsBitmask(resourceType)
  }

  const memberGroups = await getMemberUserGroups(namespace, memberId)
  let mask = 0n

  const directGroups = await listPermissionAssignments(namespace, memberId)
  for (const group of directGroups) {
    if (group.resourceType === resourceType && group.recordId === recordId) {
      mask |= BigInt(group.bitmask)
    }
  }

  for (const userGroup of memberGroups) {
    const groupAssignments = await listPermissionAssignments(namespace, userGroup.id)
    for (const group of groupAssignments) {
      if (group.resourceType === resourceType && group.recordId === recordId) {
        mask |= BigInt(group.bitmask)
      }
    }
  }

  return mask.toString()
}

async function getMemberUserGroups(
  namespace: string,
  memberId: string
): Promise<Array<{ id: string }>> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<
      Array<{ out: { id: string } }>
    >(
      'SELECT out.id AS id FROM user_group_memberships WHERE in = type::record($memberId)',
      { memberId }
    )
    return rows.map((r) => ({ id: String(r.out.id) }))
  } finally {
    await closeSurreal(surreal)
  }
}

export async function provisionDefaultCompanyGroups(
  namespace: string,
  ownerMemberId: string
): Promise<void> {
  const { DEFAULT_GROUPS } = await import('shared')
  for (const group of DEFAULT_GROUPS.company) {
    const created = await createPermissionGroup(namespace, {
      resourceType: 'company',
      name: group.name,
      bitmask: actionsToBitmask('company', group.actions),
      isSystem: true,
    })
    if (group.name === 'Owner') {
      await assignPermissionGroup(namespace, ownerMemberId, created.id)
    }
  }
}
