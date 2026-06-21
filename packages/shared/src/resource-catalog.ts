/**
 * Resource catalog for the permission system.
 *
 * Each resource declares the actions that may be performed on it. Actions are
 * encoded as bit flags so that a permission mask is a compact integer. Several
 * actions are "compound" bits: their numeric value is the bitwise OR of the
 * simpler actions they imply. This lets `hasAction` use the simple and fast
 * check `(mask & required) === required` while still answering questions like
 * "does this mask allow editing?" when only `create` was granted.
 *
 * Bit layout used by this catalog:
 *
 *   1 (0b0000000001) - view / the lowest capability bit.
 *   3 (0b0000000011) - edit / edit_info; includes view.
 *   5 (0b0000000101) - create (view-only variant); includes view.
 *   7 (0b0000000111) - create (edit variant); includes edit and view.
 *   9 (0b0000001001) - delete; includes view but is otherwise standalone.
 *  17 (0b0000010001) - manage_groups; includes view.
 *  19 (0b0000010011) - add_member / publish; includes edit and view.
 *  33 (0b0000100001) - impersonate; includes view.
 *  35 (0b0000100011) - remove_member; includes edit and view.
 * 128 (0b0010000000) - update_default_view_settings; standalone special bit.
 * 256 (0b0100000000) - edit_schema; standalone special bit.
 * 512 (0b1000000000) - manage_permissions; standalone special bit.
 *
 * The special standalone bits (128, 256, 512) do not imply any other actions.
 * They are used for elevated platform/tenant operations such as changing the
 * default view settings, editing the schema, or managing permission grants.
 */

export interface BitMappingEntry<ActionName extends string = string> {
  bit: number
  name: ActionName
  description?: string
}

export interface DefaultGroup {
  name: string
  bitmask: number
  propagateMask: number
}

export interface ResourceTypeDefinition<
  Name extends string = string,
  ActionName extends string = string,
> {
  name: Name
  table: string | 'none'
  hasRecordId: boolean
  bitMapping: readonly BitMappingEntry<ActionName>[]
  defaultGroups: readonly DefaultGroup[]
  parentResourceType?: string
  isSystem: boolean
  scope: 'platform' | 'tenant'
}

// ---------------------------------------------------------------------------
// Action bit constants
// ---------------------------------------------------------------------------

const bits = {
  view: 1,
  edit: 3,
  createImpliesView: 5,
  createImpliesEdit: 7,
  delete: 9,
  manageGroups: 17,
  addMember: 19,
  impersonate: 33,
  removeMember: 35,
  publish: 19,
} as const

/** Standalone special bits that do not imply any other action. */
const specialBits = {
  updateDefaultViewSettings: 128,
  editSchema: 256,
  managePermissions: 512,
} as const

// ---------------------------------------------------------------------------
// Reusable bit-mapping entries
// ---------------------------------------------------------------------------

const common = {
  view: { bit: bits.view, name: 'view' as const },
  edit: { bit: bits.edit, name: 'edit' as const },
  editInfo: { bit: bits.edit, name: 'edit_info' as const },
  createImpliesView: { bit: bits.createImpliesView, name: 'create' as const },
  createImpliesEdit: { bit: bits.createImpliesEdit, name: 'create' as const },
  delete: { bit: bits.delete, name: 'delete' as const },
  manageGroups: { bit: bits.manageGroups, name: 'manage_groups' as const },
  impersonate: { bit: bits.impersonate, name: 'impersonate' as const },
  addMember: { bit: bits.addMember, name: 'add_member' as const },
  removeMember: { bit: bits.removeMember, name: 'remove_member' as const },
  assignCompany: { bit: bits.addMember, name: 'assign_company' as const },
  removeCompany: { bit: bits.removeMember, name: 'remove_company' as const },
  publish: { bit: bits.publish, name: 'publish' as const },
  updateDefaultViewSettings: {
    bit: specialBits.updateDefaultViewSettings,
    name: 'update_default_view_settings' as const,
  },
  editSchema: { bit: specialBits.editSchema, name: 'edit_schema' as const },
  managePermissions: {
    bit: specialBits.managePermissions,
    name: 'manage_permissions' as const,
  },
} as const

const specialBitsEntries = [
  common.updateDefaultViewSettings,
  common.editSchema,
  common.managePermissions,
] as const

// ---------------------------------------------------------------------------
// Reusable action sets
// ---------------------------------------------------------------------------

const adminUserActions = [
  common.view,
  common.edit,
  common.createImpliesEdit,
  common.delete,
  common.manageGroups,
  common.impersonate,
] as const

const groupManagementActions = [
  common.view,
  common.editInfo,
  common.createImpliesView,
  common.delete,
  common.addMember,
  common.removeMember,
] as const

const tenantCrudActions = [
  common.view,
  common.edit,
  common.createImpliesEdit,
  common.delete,
] as const

const tenantWorkflowActions = [
  common.view,
  common.edit,
  common.createImpliesView,
  common.delete,
] as const

// ---------------------------------------------------------------------------
// Catalog factory helpers
// ---------------------------------------------------------------------------

/** Extract the `name` field of each bit-mapping entry as a literal tuple. */
function namesOf<const T extends readonly { readonly name: string }[]>(
  entries: T
): { [K in keyof T]: T[K]['name'] } {
  return entries.map((entry) => entry.name) as { [K in keyof T]: T[K]['name'] }
}

function computeGroupBitmask(
  bitMapping: readonly BitMappingEntry[],
  actions: readonly string[]
): number {
  const bitByName = new Map(bitMapping.map((b) => [b.name, b.bit]))
  return actions.reduce((mask, action) => {
    const bit = bitByName.get(action)
    if (bit === undefined) {
      throw new Error(`Unknown action: ${action}`)
    }
    return mask | bit
  }, 0)
}

function buildDefaultGroups<ActionName extends string>(
  bitMapping: readonly BitMappingEntry<ActionName>[],
  groupActions: {
    owner: readonly ActionName[]
    admin?: readonly ActionName[]
    user?: readonly ActionName[]
  }
): DefaultGroup[] {
  const groups: DefaultGroup[] = []

  const ownerMask = computeGroupBitmask(bitMapping, groupActions.owner)
  groups.push({ name: 'owner', bitmask: ownerMask, propagateMask: ownerMask })

  if (groupActions.admin) {
    const adminMask = computeGroupBitmask(bitMapping, groupActions.admin)
    groups.push({ name: 'admin', bitmask: adminMask, propagateMask: adminMask })
  }

  if (groupActions.user) {
    const userMask = computeGroupBitmask(bitMapping, groupActions.user)
    groups.push({ name: 'user', bitmask: userMask, propagateMask: 0 })
  }

  return groups
}

function fullAccessGroups<const Actions extends readonly { readonly name: string }[]>(
  actions: Actions
) {
  const names = namesOf(actions)
  return {
    owner: names,
    admin: names,
    user: ['view'] as const,
  }
}

function ownerFullAccessGroups<const Actions extends readonly { readonly name: string }[]>(
  actions: Actions
) {
  return { owner: namesOf(actions) }
}

function defineResource<
  const Name extends string,
  const Actions extends readonly { readonly bit: number; readonly name: string }[],
>(
  config: {
    name: Name
    table: string | 'none'
    hasRecordId: boolean
    bitMapping: Actions
    defaultGroupActions: {
      owner: readonly Actions[number]['name'][]
      admin?: readonly Actions[number]['name'][]
      user?: readonly Actions[number]['name'][]
    }
    parentResourceType?: string
    isSystem: boolean
    scope: 'platform' | 'tenant'
  }
): ResourceTypeDefinition<Name, Actions[number]['name']> {
  const { defaultGroupActions, ...rest } = config
  return {
    ...rest,
    defaultGroups: buildDefaultGroups(config.bitMapping, defaultGroupActions),
  }
}

// ---------------------------------------------------------------------------
// Platform catalog
// ---------------------------------------------------------------------------

const adminUserFullBits = [...adminUserActions, ...specialBitsEntries] as const
const groupFullBits = [...groupManagementActions, ...specialBitsEntries] as const
const companyMemberFullBits = [
  common.view,
  common.editInfo,
  common.createImpliesView,
  common.delete,
  common.assignCompany,
  common.removeCompany,
  ...specialBitsEntries,
] as const
const platformWorkflowFullBits = [
  common.view,
  common.edit,
  common.createImpliesEdit,
  common.delete,
  common.publish,
  ...specialBitsEntries,
] as const

const PLATFORM_CATALOG = {
  platform: defineResource({
    name: 'platform',
    table: 'none',
    hasRecordId: false,
    bitMapping: [common.view, ...specialBitsEntries],
    defaultGroupActions: ownerFullAccessGroups([common.view, ...specialBitsEntries]),
    isSystem: true,
    scope: 'platform',
  }),

  admin_user: defineResource({
    name: 'admin_user',
    table: 'platform_users',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: adminUserFullBits,
    defaultGroupActions: fullAccessGroups(adminUserFullBits),
    isSystem: true,
    scope: 'platform',
  }),

  admin_user_detail: defineResource({
    name: 'admin_user_detail',
    table: 'platform_users',
    hasRecordId: true,
    parentResourceType: 'admin_user',
    bitMapping: adminUserActions,
    defaultGroupActions: ownerFullAccessGroups(adminUserActions),
    isSystem: true,
    scope: 'platform',
  }),

  admin_user_group: defineResource({
    name: 'admin_user_group',
    table: 'admin_user_groups',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: groupFullBits,
    defaultGroupActions: fullAccessGroups(groupFullBits),
    isSystem: true,
    scope: 'platform',
  }),

  admin_user_group_detail: defineResource({
    name: 'admin_user_group_detail',
    table: 'admin_user_groups',
    hasRecordId: true,
    parentResourceType: 'admin_user_group',
    bitMapping: groupManagementActions,
    defaultGroupActions: ownerFullAccessGroups(groupManagementActions),
    isSystem: true,
    scope: 'platform',
  }),

  company: defineResource({
    name: 'company',
    table: 'companies',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: groupFullBits,
    defaultGroupActions: fullAccessGroups(groupFullBits),
    isSystem: true,
    scope: 'platform',
  }),

  company_member: defineResource({
    name: 'company_member',
    table: 'user_profiles',
    hasRecordId: false,
    parentResourceType: 'company',
    bitMapping: companyMemberFullBits,
    defaultGroupActions: fullAccessGroups(companyMemberFullBits),
    isSystem: true,
    scope: 'platform',
  }),

  workflow_design: defineResource({
    name: 'workflow_design',
    table: 'workflow_designs',
    hasRecordId: false,
    parentResourceType: 'platform',
    bitMapping: platformWorkflowFullBits,
    defaultGroupActions: fullAccessGroups(platformWorkflowFullBits),
    isSystem: true,
    scope: 'platform',
  }),

  workflow_design_detail: defineResource({
    name: 'workflow_design_detail',
    table: 'workflow_designs',
    hasRecordId: true,
    parentResourceType: 'workflow_design',
    bitMapping: [
      common.view,
      common.edit,
      common.createImpliesEdit,
      common.delete,
      common.publish,
    ] as const,
    defaultGroupActions: ownerFullAccessGroups([
      common.view,
      common.edit,
      common.createImpliesEdit,
      common.delete,
      common.publish,
    ] as const),
    isSystem: true,
    scope: 'platform',
  }),
} as const

// ---------------------------------------------------------------------------
// Tenant catalog
// ---------------------------------------------------------------------------

const tenantCrudFullBits = [...tenantCrudActions, ...specialBitsEntries] as const
const tenantWorkflowFullBits = [...tenantWorkflowActions, ...specialBitsEntries] as const

const TENANT_CATALOG = {
  tenant: defineResource({
    name: 'tenant',
    table: 'none',
    hasRecordId: false,
    bitMapping: tenantCrudFullBits,
    defaultGroupActions: ownerFullAccessGroups(tenantCrudFullBits),
    isSystem: true,
    scope: 'tenant',
  }),

  member: defineResource({
    name: 'member',
    table: 'members',
    hasRecordId: false,
    parentResourceType: 'tenant',
    bitMapping: tenantCrudFullBits,
    defaultGroupActions: fullAccessGroups(tenantCrudFullBits),
    isSystem: true,
    scope: 'tenant',
  }),

  user_group: defineResource({
    name: 'user_group',
    table: 'user_groups',
    hasRecordId: false,
    parentResourceType: 'tenant',
    bitMapping: groupFullBits,
    defaultGroupActions: fullAccessGroups(groupFullBits),
    isSystem: true,
    scope: 'tenant',
  }),

  user_group_detail: defineResource({
    name: 'user_group_detail',
    table: 'user_groups',
    hasRecordId: true,
    parentResourceType: 'user_group',
    bitMapping: groupManagementActions,
    defaultGroupActions: ownerFullAccessGroups(groupManagementActions),
    isSystem: true,
    scope: 'tenant',
  }),

  workflow_design: defineResource({
    name: 'workflow_design',
    table: 'workflow_designs',
    hasRecordId: false,
    parentResourceType: 'tenant',
    bitMapping: tenantWorkflowFullBits,
    defaultGroupActions: fullAccessGroups(tenantWorkflowFullBits),
    isSystem: true,
    scope: 'tenant',
  }),

  workflow_design_detail: defineResource({
    name: 'workflow_design_detail',
    table: 'workflow_designs',
    hasRecordId: true,
    parentResourceType: 'workflow_design',
    bitMapping: tenantWorkflowActions,
    defaultGroupActions: ownerFullAccessGroups(tenantWorkflowActions),
    isSystem: true,
    scope: 'tenant',
  }),
} as const

// ---------------------------------------------------------------------------
// Merged catalog
// ---------------------------------------------------------------------------

/**
 * The full resource catalog. Platform and tenant scopes are merged so that
 * duplicate resource names keep the tenant-scoped definition, matching the
 * previous runtime behavior where the tenant array was spread last.
 */
export const RESOURCE_CATALOG = { ...PLATFORM_CATALOG, ...TENANT_CATALOG } as const

export type ResourceType = keyof typeof RESOURCE_CATALOG
export type PermissionAction<T extends ResourceType = ResourceType> =
  (typeof RESOURCE_CATALOG)[T]['bitMapping'][number]['name']

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function resourceType<T extends ResourceType>(
  name: T
): ResourceTypeDefinition<T, PermissionAction<T>> {
  const def = RESOURCE_CATALOG[name]
  if (!def) throw new Error(`Unknown resource type: ${String(name)}`)
  return def as ResourceTypeDefinition<T, PermissionAction<T>>
}

export function actionValue<T extends ResourceType>(
  name: T,
  action: PermissionAction<T>
): number {
  const def = resourceType(name)
  const entry = def.bitMapping.find((b) => b.name === action)
  if (!entry) throw new Error(`Unknown action ${action} for ${String(name)}`)
  return entry.bit
}

export function actionsToBitmask<T extends ResourceType>(
  name: T,
  actions: PermissionAction<T>[]
): string {
  const mask = actions.reduce((m, action) => m | actionValue(name, action), 0)
  return mask.toString()
}

export function bitmaskToActions<T extends ResourceType>(
  name: T,
  bitmask: string | number
): PermissionAction<T>[] {
  const mask = typeof bitmask === 'string' ? Number(bitmask) : bitmask
  const def = resourceType(name)
  return def.bitMapping.filter((b) => (mask & b.bit) === b.bit).map((b) => b.name)
}

export function hasAction<T extends ResourceType>(
  bitmask: string | number,
  name: T,
  action: PermissionAction<T>
): boolean {
  const mask = typeof bitmask === 'string' ? Number(bitmask) : bitmask
  const required = actionValue(name, action)
  return (mask & required) === required
}

export function allActionsBitmask<T extends ResourceType>(name: T): string {
  const def = resourceType(name)
  return def.bitMapping.reduce((m, b) => m | b.bit, 0).toString()
}

export function defaultGroups<T extends ResourceType>(name: T): DefaultGroup[] {
  return resourceType(name).defaultGroups.slice()
}
