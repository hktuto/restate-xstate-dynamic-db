export const RESOURCE_ACTIONS = {
  company: ['view', 'manage_settings', 'manage_permissions', 'manage_user_groups', 'invite_member', 'remove_member'],
  user_group: ['view', 'update', 'delete', 'add_member', 'remove_member', 'manage_permissions'],
  workflow_design: ['view', 'create', 'update', 'delete', 'trigger'],
} as const

export type ResourceType = keyof typeof RESOURCE_ACTIONS
export type PermissionAction<T extends ResourceType = ResourceType> =
  (typeof RESOURCE_ACTIONS)[T][number]

export function actionValue<T extends ResourceType>(resourceType: T, action: PermissionAction<T>): bigint {
  const actions = RESOURCE_ACTIONS[resourceType] as readonly PermissionAction<T>[]
  const idx = actions.indexOf(action)
  if (idx === -1) throw new Error(`Unknown action ${action} for ${resourceType}`)
  return 1n << BigInt(idx)
}

export function actionsToBitmask<T extends ResourceType>(
  resourceType: T,
  actions: PermissionAction<T>[]
): string {
  let mask = 0n
  for (const action of actions) {
    mask |= actionValue(resourceType, action)
  }
  return mask.toString()
}

export function bitmaskToActions<T extends ResourceType>(
  resourceType: T,
  bitmask: string | bigint
): PermissionAction<T>[] {
  const mask = typeof bitmask === 'string' ? BigInt(bitmask) : bitmask
  const actions = RESOURCE_ACTIONS[resourceType] as readonly PermissionAction<T>[]
  return actions.filter((_, i) => (mask & (1n << BigInt(i))) !== 0n)
}

export function hasAction<T extends ResourceType>(
  bitmask: string | bigint,
  resourceType: T,
  action: PermissionAction<T>
): boolean {
  const mask = typeof bitmask === 'string' ? BigInt(bitmask) : bitmask
  return (mask & actionValue(resourceType, action)) !== 0n
}

export function allActionsBitmask<T extends ResourceType>(resourceType: T): string {
  const actions = RESOURCE_ACTIONS[resourceType]
  return ((1n << BigInt(actions.length)) - 1n).toString()
}

export const DEFAULT_GROUPS: {
  [K in ResourceType]: Array<{ name: string; actions: PermissionAction<K>[] }>
} = {
  company: [
    { name: 'Owner', actions: ['view', 'manage_settings', 'manage_permissions', 'manage_user_groups', 'invite_member', 'remove_member'] },
    { name: 'Admin', actions: ['view', 'manage_settings', 'manage_permissions', 'manage_user_groups', 'invite_member', 'remove_member'] },
    { name: 'Member', actions: ['view'] },
  ],
  user_group: [
    { name: 'Owner', actions: ['view', 'update', 'delete', 'add_member', 'remove_member', 'manage_permissions'] },
    { name: 'Admin', actions: ['view', 'update', 'add_member', 'remove_member'] },
    { name: 'Member', actions: ['view'] },
  ],
  workflow_design: [
    { name: 'Owner', actions: ['view', 'create', 'update', 'delete', 'trigger'] },
    { name: 'Editor', actions: ['view', 'create', 'update', 'trigger'] },
    { name: 'Viewer', actions: ['view'] },
  ],
}
