import type { ObjectContext } from '@restatedev/restate-sdk'
import type { AnyMachineSnapshot } from 'xstate'
import type { Condition, PersistedState } from './types.js'

function isCondition(value: string): value is Condition {
  return value === 'done' || value.startsWith('hasTag:')
}

export function evaluateCondition(snapshot: AnyMachineSnapshot, condition: Condition): boolean {
  if (condition === 'done') {
    return snapshot.status === 'done'
  }
  if (condition.startsWith('hasTag:')) {
    return snapshot.hasTag(condition.slice(7))
  }
  return false
}

export async function resolveMatchingSubscriptions(
  ctx: ObjectContext,
  snapshot: AnyMachineSnapshot
) {
  const state = (await ctx.get<PersistedState>('state'))
  if (!state?.subscriptions) return

  for (const [conditionStr, subscription] of Object.entries(state.subscriptions)) {
    if (!isCondition(conditionStr) || !subscription) continue
    if (evaluateCondition(snapshot, conditionStr)) {
      for (const awakeableId of subscription.awakeables) {
        ctx.resolveAwakeable(awakeableId, snapshot)
      }
      delete state.subscriptions[conditionStr]
    }
  }

  ctx.set('state', state)
}

export async function registerSubscription(
  ctx: ObjectContext,
  condition: Condition,
  awakeableId: string
) {
  const state = await ctx.get<PersistedState>('state')
  if (!state) {
    throw new Error('Cannot register subscription: workflow state not found')
  }
  if (!state.subscriptions) state.subscriptions = {}

  const existing = state.subscriptions[condition]
  if (existing) {
    existing.awakeables.push(awakeableId)
  } else {
    state.subscriptions[condition] = { awakeables: [awakeableId] }
  }

  ctx.set('state', state)
}
