export interface Namespace {
  namespace: string
  database: string
}

export function useNamespace(): Namespace {
  throw new Error('useNamespace must be provided by the host app. Create apps/<app>/composables/useNamespace.ts to override this layer default.')
}
