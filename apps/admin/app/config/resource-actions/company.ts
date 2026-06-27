import type { ResourceActionPlacement } from 'shared'

export const resourceActionPlacements: Record<string, ResourceActionPlacement[]> = {
  edit_info: [
    {
      type: ['table'],
      location: 'item-contextMenu',
      component: 'EditCompanyAction',
      method: 'open',
    },
    {
      type: ['table'],
      location: 'item-rowDoubleClick',
      component: 'EditCompanyAction',
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
