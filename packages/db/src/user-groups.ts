import { StringRecordId } from 'surrealdb'
import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'
import { defaultGroups, type ResourceType } from 'shared'
import {
  createPermissionGroup,
  assignPermissionGroup,
  listPermissionGroups,
  applyPermissionToResource,
} from './permissions.js'

export interface UserGroupRecord {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface UserGroupInput {
  name: string
  description?: string
}

export async function createUserGroup(
  namespace: string,
  input: UserGroupInput
): Promise<UserGroupRecord> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const now = new Date().toISOString()
    const data = { ...input, createdAt: now, updatedAt: now }
    const [created] = await surreal.query<[UserGroupRecord[]]>(
      'CREATE user_groups CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listUserGroups(namespace: string): Promise<UserGroupRecord[]> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [groups] = await surreal.query<[UserGroupRecord[]]>('SELECT * FROM user_groups ORDER BY name')
    return normalizeIds(groups)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getUserGroupById(
  namespace: string,
  id: string
): Promise<UserGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [result] = await surreal.query<[UserGroupRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateUserGroup(
  namespace: string,
  id: string,
  input: Partial<UserGroupInput>
): Promise<UserGroupRecord | undefined> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const data = { ...input, updatedAt: new Date().toISOString() }
    const [updated] = await surreal.query<[UserGroupRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deleteUserGroup(namespace: string, id: string): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query('DELETE user_group_memberships WHERE out = type::record($id)', { id })
    const groups = await listPermissionGroups(namespace, 'main', 'user_group_detail', id)
    for (const group of groups) {
      await surreal.query('DELETE permission_assignments WHERE out = type::record($id)', { id: group.id })
      await surreal.query('DELETE permission_apply_to WHERE in = type::record($id)', { id: group.id })
      await surreal.query('DELETE type::record($id)', { id: group.id })
    }
    await surreal.query('DELETE permission_assignments WHERE in = type::record($id)', { id })
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export async function addUserGroupMember(
  namespace: string,
  memberId: string,
  userGroupId: string
): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query(
      'RELATE $memberId->user_group_memberships->$userGroupId',
      {
        memberId: new StringRecordId(memberId),
        userGroupId: new StringRecordId(userGroupId),
      }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function removeUserGroupMember(
  namespace: string,
  memberId: string,
  userGroupId: string
): Promise<void> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    await surreal.query(
      'DELETE user_group_memberships WHERE in = type::record($memberId) AND out = type::record($userGroupId)',
      { memberId, userGroupId }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listUserGroupMembers(
  namespace: string,
  userGroupId: string
): Promise<Array<{ id: string }>> {
  const surreal = await getSurreal(namespace, 'main')
  try {
    const [rows] = await surreal.query<
      [Array<{ id: string }>]
    >(
      'SELECT in.id AS id FROM user_group_memberships WHERE out = type::record($userGroupId)',
      { userGroupId }
    )
    return rows.map((r) => ({ id: String(r.id) }))
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createUserGroupWithDefaults(
  namespace: string,
  input: UserGroupInput,
  creatorMemberId: string
): Promise<UserGroupRecord> {
  const group = await createUserGroup(namespace, input)
  const groups = defaultGroups('user_group_detail')
  for (const groupDef of groups) {
    const created = await createPermissionGroup(namespace, 'main', {
      resourceType: 'user_group_detail',
      recordId: group.id,
      name: groupDef.name,
      isSystem: true,
    })
    await applyPermissionToResource(namespace, 'main', {
      groupId: created.id,
      resourceType: 'user_group_detail',
      bitmask: groupDef.bitmask,
      propagateMask: groupDef.propagateMask,
    })
    if (groupDef.name === 'owner') {
      await assignPermissionGroup(namespace, 'main', creatorMemberId, created.id)
    }
  }
  return group
}
