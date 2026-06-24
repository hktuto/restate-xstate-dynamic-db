import type { ResourceActionPlacement } from 'shared'

export const resourceActionPlacements: Record<string, ResourceActionPlacement[]> = {
  create: [
    {
      type: ['table'],
      location: 'toolbar',
      component: 'CreateCompanyButton',
      method: null,
    },
  ],
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
  delete: [
    {
      type: ['table'],
      location: 'item-contextMenu',
      component: 'DeleteCompanyAction',
      method: 'open',
    },
  ],
}
