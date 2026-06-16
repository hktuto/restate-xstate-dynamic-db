import { createActor } from 'xstate'
import type { AnyStateMachine, AnyMachineSnapshot } from 'xstate'

export function restoreActor(machine: AnyStateMachine, snapshot?: AnyMachineSnapshot) {
  const actor = snapshot ? createActor(machine, { state: snapshot }) : createActor(machine)
  actor.start()
  return actor
}
