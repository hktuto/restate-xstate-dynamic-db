function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const HEALTH_CHECK_HISTORY_LIMIT = parsePositiveInt(
  process.env.HEALTH_CHECK_HISTORY_LIMIT,
  100
)
