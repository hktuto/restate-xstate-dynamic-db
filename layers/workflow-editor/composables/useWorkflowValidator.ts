import type { WorkflowDefinition } from 'shared'

export interface ValidationError {
  path: string
  message: string
}

export function useWorkflowValidator() {
  function validate(definition: WorkflowDefinition): ValidationError[] {
    const errors: ValidationError[] = []

    if (!definition.id) {
      errors.push({ path: 'id', message: 'Workflow id is required' })
    }

    if (!definition.initial) {
      errors.push({ path: 'initial', message: 'Initial state is required' })
    }

    const stateIds = Object.keys(definition.states)
    if (stateIds.length === 0) {
      errors.push({ path: 'states', message: 'At least one state is required' })
    }

    if (definition.initial && !stateIds.includes(definition.initial)) {
      errors.push({ path: 'initial', message: 'Initial state must exist in states' })
    }

    for (const [stateId, stateDef] of Object.entries(definition.states)) {
      for (const [event, transition] of Object.entries(stateDef.on || {})) {
        const targets = Array.isArray(transition) ? transition : [transition]
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i]
          if (!stateIds.includes(t.target)) {
            errors.push({
              path: `states.${stateId}.on.${event}[${i}].target`,
              message: `Target state "${t.target}" does not exist`
            })
          }
        }
      }
    }

    return errors
  }

  return { validate }
}
