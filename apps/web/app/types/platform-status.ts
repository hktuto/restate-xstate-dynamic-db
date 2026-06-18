export interface PlatformStatus {
  mode: 'normal' | 'degraded' | 'maintenance'
  message?: string
  checkedAt?: string
}
