import { StringRecordId } from 'surrealdb'
import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'

export interface AdminUserGroupRecord {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface AdminUserGroupInput {
  name: string
  description?: string
}

export async function listAdminUserGroups(): Promise<AdminUserGroupRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [groups] = await surreal.query<[AdminUserGroupRecord[]]>(
      'SELECT * FROM admin_user_groups ORDER BY name'
    )
    return normalizeIds(groups)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getAdminUserGroupById(id: string): Promise<AdminUserGroupRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [result] = await surreal.query<[AdminUserGroupRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id }
    )
    return normalizeId(result[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function createAdminUserGroup(input: AdminUserGroupInput): Promise<AdminUserGroupRecord> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const now = new Date().toISOString()
    const data = { ...input, createdAt: now, updatedAt: now }
    const [created] = await surreal.query<[AdminUserGroupRecord[]]>(
      'CREATE admin_user_groups CONTENT $data',
      { data }
    )
    return normalizeId(created[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function updateAdminUserGroup(
  id: string,
  input: Partial<AdminUserGroupInput>
): Promise<AdminUserGroupRecord | undefined> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const data = { ...input, updatedAt: new Date().toISOString() }
    const [updated] = await surreal.query<[AdminUserGroupRecord[]]>(
      'UPDATE type::record($id) MERGE $data',
      { id, data }
    )
    return normalizeId(updated[0])
  } finally {
    await closeSurreal(surreal)
  }
}

export async function deleteAdminUserGroup(id: string): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query(
      'DELETE admin_user_group_memberships WHERE out = type::record($id)',
      { id }
    )
    await surreal.query('DELETE type::record($id)', { id })
  } finally {
    await closeSurreal(surreal)
  }
}

export async function setAdminUserGroupMemberships(
  userId: string,
  groupIds: string[]
): Promise<void> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query(
      'DELETE admin_user_group_memberships WHERE in = type::record($userId)',
      { userId }
    )
    for (const groupId of groupIds) {
      await surreal.query(
        'RELATE $userId->admin_user_group_memberships->$groupId',
        {
          userId: new StringRecordId(userId),
          groupId: new StringRecordId(groupId),
        }
      )
    }
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listAdminUserGroupMemberships(
  userId: string
): Promise<AdminUserGroupRecord[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [groups] = await surreal.query<[AdminUserGroupRecord[]]>(
      'SELECT out.* AS group FROM admin_user_group_memberships WHERE in = type::record($userId)',
      { userId }
    )
    return normalizeIds(groups.map((g: any) => g.group))
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listAdminUserGroupMemberIds(
  groupId: string
): Promise<string[]> {
  const surreal = await getSurreal('platform', 'admin')
  try {
    const [rows] = await surreal.query<[Array<{ id: string }>]>(
      'SELECT in.id AS id FROM admin_user_group_memberships WHERE out = type::record($groupId)',
      { groupId }
    )
    return rows.map((r) => String(r.id))
  } finally {
    await closeSurreal(surreal)
  }
}
