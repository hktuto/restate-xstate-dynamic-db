export function normalizeId<T extends { id: unknown }>(record: T | undefined): T | undefined {
  if (!record) return undefined
  return { ...record, id: String(record.id) } as T
}

export function normalizeIds<T extends { id: unknown }>(records: T[]): T[] {
  return records.map(r => ({ ...r, id: String(r.id) }) as T)
}
