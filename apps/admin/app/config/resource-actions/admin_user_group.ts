import type { ResourceActionPlacement } from 'shared'

export const resourceActionPlacements: Record<string, ResourceActionPlacement[]> = {
  create: [
    {
      type: ['table'],
      location: 'toolbar',
      component: 'CreateAdminUserGroupButton',
      method: null,
    },
  ],
  edit_info: [
    {
      type: ['table'],
      location: 'item-contextMenu',
      component: 'EditAdminUserGroupAction',
      method: 'open',
    },
    {
      type: ['table'],
      location: 'item-rowDoubleClick',
      component: 'EditAdminUserGroupAction',
      method: 'open',
    },
  ],
  delete: [
    {
      type: ['table'],
      location: 'item-contextMenu',
      component: 'DeleteAdminUserGroupAction',
      method: 'open',
    },
  ],
  edit_schema: [
    {
      type: ['table'],
      location: 'toolbar',
      component: 'EditSchema',
      method: null,
    },
  ],
  manage_permissions: [
    {
      type: ['table'],
      location: 'toolbar',
      component: 'ManagePermissions',
      method: null,
    },
  ],
}
