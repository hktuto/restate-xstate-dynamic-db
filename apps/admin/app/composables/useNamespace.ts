export interface Namespace {
  namespace: string
  database: string
}

export function useNamespace(): Namespace {
  return { namespace: 'platform', database: 'admin' }
}
