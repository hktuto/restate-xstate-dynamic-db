import type { ResourceActionPlacement } from 'shared'

export const resourceActionPlacements: Record<string, ResourceActionPlacement[]> = {
  create: [
    {
      type: ['table'],
      location: 'toolbar',
      component: 'CreateWorkflowDesignButton',
      method: null,
    },
  ],
  edit: [
    {
      type: ['table'],
      location: 'item-contextMenu',
      component: 'EditWorkflowDesignAction',
      method: 'open',
    },
    {
      type: ['table'],
      location: 'item-rowDoubleClick',
      component: 'EditWorkflowDesignAction',
      method: 'open',
    },
  ],
  delete: [
    {
      type: ['table'],
      location: 'item-contextMenu',
      component: 'DeleteWorkflowDesignAction',
      method: 'open',
    },
  ],
}
