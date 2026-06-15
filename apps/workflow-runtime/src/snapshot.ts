import { createActor } from 'xstate'
import type { AnyActorRef, AnyStateMachine, AnyMachineSnapshot } from 'xstate'

export function restoreActor(machine: AnyStateMachine, snapshot?: AnyMachineSnapshot) {
  const actor = snapshot ? createActor(machine, { state: snapshot }) : createActor(machine)
  actor.start()
  return actor
}

export function getSnapshot(actor: AnyActorRef): AnyMachineSnapshot {
  // getPersistedSnapshot is typed as Snapshot<unknown> on AnyActorRef
  return actor.getPersistedSnapshot() as AnyMachineSnapshot
}
