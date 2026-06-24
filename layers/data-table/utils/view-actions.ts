import type { ResourceActionPlacement, ViewActionBindings } from 'shared'

export interface ResolvedActionPlacement {
  action: string
  component: string
  method?: string | null
}

export interface ResolvedActions {
  toolbar: ResolvedActionPlacement[]
  itemContextMenu: ResolvedActionPlacement[]
  rowDoubleClick?: ResolvedActionPlacement
}

function locationMatches(placementLocation: string, targetLocation: string): boolean {
  if (placementLocation === targetLocation) return true
  if (placementLocation.endsWith('*')) {
    const prefix = placementLocation.slice(0, -1)
    return targetLocation.startsWith(prefix)
  }
  return false
}

export function resolveViewActions(
  viewType: string,
  bindings: ViewActionBindings | undefined,
  resourcePlacements: Record<string, ResourceActionPlacement[]> | null,
): ResolvedActions {
  const result: ResolvedActions = { toolbar: [], itemContextMenu: [] }
  if (!bindings || !resourcePlacements) return result

  for (const [location, actions] of Object.entries(bindings)) {
    for (const actionName of actions) {
      const placements = resourcePlacements[actionName]
      if (!placements) continue
      const placement = placements.find(
        (p) => p.type.includes(viewType) && locationMatches(p.location, location),
      )
      if (!placement) continue

      const resolved: ResolvedActionPlacement = {
        action: actionName,
        component: placement.component,
        method: placement.method,
      }

      if (location === 'toolbar') {
        result.toolbar.push(resolved)
      } else if (location === 'item-contextMenu') {
        result.itemContextMenu.push(resolved)
      } else if (location === 'item-rowDoubleClick') {
        result.rowDoubleClick = resolved
      }
    }
  }

  return result
}
