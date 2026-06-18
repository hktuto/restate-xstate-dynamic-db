export interface DispatchPlatformOptions {
  skip?: boolean
}

export async function dispatchPlatformTrigger(
  _tableName: string,
  _crudEvent: string,
  _record: Record<string, unknown>,
  options: DispatchPlatformOptions = {}
) {
  if (options.skip) return
  // TODO: rewrite platform DB-trigger dispatcher for workflow_designs / starts model (Task 11)
}
