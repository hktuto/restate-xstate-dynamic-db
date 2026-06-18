import type { ActionInputMetadata } from 'shared'

export function buildContextFromInputs(
  inputs: ActionInputMetadata[],
  source: Record<string, unknown>
): Record<string, unknown> {
  const context: Record<string, unknown> = {}
  for (const input of inputs) {
    const value = source[input.name]
    if (value !== undefined && value !== null) {
      context[input.name] = value
    } else if (input.defaultValue !== undefined) {
      context[input.name] = input.defaultValue
    } else if (input.required) {
      throw new Error(`Missing required input: ${input.name}`)
    }
  }
  return context
}
