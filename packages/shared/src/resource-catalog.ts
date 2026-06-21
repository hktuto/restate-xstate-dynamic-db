export interface BitMappingEntry {
  bit: number
  name: string
  description?: string
}

export interface DefaultGroup {
  name: string
  bitmask: number
  propagateMask: number
}

export interface ResourceTypeDefinition {
  name: string
  table: string | 'none'
  hasRecordId: boolean
  bitMapping: BitMappingEntry[]
  defaultGroups: DefaultGroup[]
  parentResourceType?: string
  isSystem: boolean
  scope: 'platform' | 'tenant'
}

const specialBits = {
  updateDefaultViewSettings: 128,
  editSchema: 256,
  managePermissions: 512,
} as const

const compound = {
  view: 1,
  edit: 3,
  editInfo: 3,
  createImpliesEdit: 7,
  create: 5,
  delete: 9,
  addMember: 19,
  removeMember: 35,
  manageGroups: 17,
  impersonate: 33,
  publish: 19,
}

export const PLATFORM_RESOURCE_TYPES: ResourceTypeDefinition[] = [
  {
    name: 'platform',
    table: 'none',
    hasRecordId: false,
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 897, propagateMask: 897 },
      { name: 'admin', bitmask: 897, propagateMask: 897 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'admin_user',
    table: 'platform_users',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.manageGroups, name: 'manage_groups' },
      { bit: compound.impersonate, name: 'impersonate' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 959, propagateMask: 959 },
      { name: 'admin', bitmask: 959, propagateMask: 959 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'admin_user_detail',
    table: 'platform_users',
    hasRecordId: true,
    parentResourceType: 'admin_user',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.manageGroups, name: 'manage_groups' },
      { bit: compound.impersonate, name: 'impersonate' },
    ],
    defaultGroups: [{ name: 'owner', bitmask: 63, propagateMask: 63 }],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'admin_user_group',
    table: 'admin_user_groups',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'add_member' },
      { bit: compound.removeMember, name: 'remove_member' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 959, propagateMask: 959 },
      { name: 'admin', bitmask: 959, propagateMask: 959 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'admin_user_group_detail',
    table: 'admin_user_groups',
    hasRecordId: true,
    parentResourceType: 'admin_user_group',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'add_member' },
      { bit: compound.removeMember, name: 'remove_member' },
    ],
    defaultGroups: [{ name: 'owner', bitmask: 63, propagateMask: 63 }],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'company',
    table: 'companies',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'add_member' },
      { bit: compound.removeMember, name: 'remove_member' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 959, propagateMask: 959 },
      { name: 'admin', bitmask: 959, propagateMask: 959 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'company_member',
    table: 'user_profiles',
    hasRecordId: false,
    parentResourceType: 'company',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'assign_company' },
      { bit: compound.removeMember, name: 'remove_company' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 959, propagateMask: 959 },
      { name: 'admin', bitmask: 959, propagateMask: 959 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'workflow_design',
    table: 'workflow_designs',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.publish, name: 'publish' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 927, propagateMask: 927 },
      { name: 'admin', bitmask: 927, propagateMask: 927 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'platform',
  },
  {
    name: 'workflow_design_detail',
    table: 'workflow_designs',
    hasRecordId: true,
    parentResourceType: 'workflow_design',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.publish, name: 'publish' },
    ],
    defaultGroups: [{ name: 'owner', bitmask: 31, propagateMask: 31 }],
    isSystem: true,
    scope: 'platform',
  },
]

export const TENANT_RESOURCE_TYPES: ResourceTypeDefinition[] = [
  {
    name: 'tenant',
    table: 'none',
    hasRecordId: false,
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 911, propagateMask: 911 },
      { name: 'admin', bitmask: 911, propagateMask: 911 },
    ],
    isSystem: true,
    scope: 'tenant',
  },
  {
    name: 'member',
    table: 'members',
    hasRecordId: false,
    parentResourceType: 'tenant',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.createImpliesEdit, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 911, propagateMask: 911 },
      { name: 'admin', bitmask: 911, propagateMask: 911 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'tenant',
  },
  {
    name: 'user_group',
    table: 'user_groups',
    hasRecordId: false,
    parentResourceType: 'tenant',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'add_member' },
      { bit: compound.removeMember, name: 'remove_member' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 959, propagateMask: 959 },
      { name: 'admin', bitmask: 959, propagateMask: 959 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'tenant',
  },
  {
    name: 'user_group_detail',
    table: 'user_groups',
    hasRecordId: true,
    parentResourceType: 'user_group',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.editInfo, name: 'edit_info' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: compound.addMember, name: 'add_member' },
      { bit: compound.removeMember, name: 'remove_member' },
    ],
    defaultGroups: [{ name: 'owner', bitmask: 63, propagateMask: 63 }],
    isSystem: true,
    scope: 'tenant',
  },
  {
    name: 'workflow_design',
    table: 'workflow_designs',
    hasRecordId: false,
    parentResourceType: 'tenant',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
      { bit: specialBits.updateDefaultViewSettings, name: 'update_default_view_settings' },
      { bit: specialBits.editSchema, name: 'edit_schema' },
      { bit: specialBits.managePermissions, name: 'manage_permissions' },
    ],
    defaultGroups: [
      { name: 'owner', bitmask: 911, propagateMask: 911 },
      { name: 'admin', bitmask: 911, propagateMask: 911 },
      { name: 'user', bitmask: 1, propagateMask: 0 },
    ],
    isSystem: true,
    scope: 'tenant',
  },
  {
    name: 'workflow_design_detail',
    table: 'workflow_designs',
    hasRecordId: true,
    parentResourceType: 'workflow_design',
    bitMapping: [
      { bit: compound.view, name: 'view' },
      { bit: compound.edit, name: 'edit' },
      { bit: compound.create, name: 'create' },
      { bit: compound.delete, name: 'delete' },
    ],
    defaultGroups: [{ name: 'owner', bitmask: 15, propagateMask: 15 }],
    isSystem: true,
    scope: 'tenant',
  },
]

export const RESOURCE_CATALOG: Record<string, ResourceTypeDefinition> = Object.fromEntries(
  [...PLATFORM_RESOURCE_TYPES, ...TENANT_RESOURCE_TYPES].map((r) => [r.name, r])
)

export type ResourceType = keyof typeof RESOURCE_CATALOG
export type PermissionAction<T extends ResourceType = ResourceType> =
  Extract<(typeof RESOURCE_CATALOG)[T]['bitMapping'][number]['name'], string>

export function resourceType(name: ResourceType): ResourceTypeDefinition {
  const def = RESOURCE_CATALOG[name]
  if (!def) throw new Error(`Unknown resource type: ${String(name)}`)
  return def
}

export function actionValue(name: ResourceType, action: string): number {
  const def = resourceType(name)
  const entry = def.bitMapping.find((b) => b.name === action)
  if (!entry) throw new Error(`Unknown action ${action} for ${String(name)}`)
  return entry.bit
}

export function actionsToBitmask(name: ResourceType, actions: string[]): string {
  const mask = actions.reduce((m, action) => m | actionValue(name, action), 0)
  return mask.toString()
}

export function bitmaskToActions(name: ResourceType, bitmask: string | number): string[] {
  const mask = typeof bitmask === 'string' ? Number(bitmask) : bitmask
  const def = resourceType(name)
  return def.bitMapping.filter((b) => (mask & b.bit) === b.bit).map((b) => b.name)
}

export function hasAction(bitmask: string | number, name: ResourceType, action: string): boolean {
  const mask = typeof bitmask === 'string' ? Number(bitmask) : bitmask
  const required = actionValue(name, action)
  return (mask & required) === required
}

export function allActionsBitmask(name: ResourceType): string {
  const def = resourceType(name)
  return def.bitMapping.reduce((m, b) => m | b.bit, 0).toString()
}

export function defaultGroups(name: ResourceType): DefaultGroup[] {
  return resourceType(name).defaultGroups
}
