import { StringRecordId } from 'surrealdb'
import { RESOURCE_CATALOG, type ResourceTypeDefinition } from 'shared'
import { getSurreal, closeSurreal } from './client.js'
import { normalizeId, normalizeIds } from './normalize.js'

export interface ResourceTypeRecord extends ResourceTypeDefinition {
  id: string
}

export function resourceTypeRecordId(name: string): string {
  return `resource_types:⟨${name}⟩`
}

export async function upsertResourceType(
  namespace: string,
  database: string,
  def: ResourceTypeDefinition
): Promise<ResourceTypeRecord> {
  const surreal = await getSurreal(namespace, database)
  try {
    const now = new Date().toISOString()
    const id = resourceTypeRecordId(def.name)
    const [rows] = await surreal.query<[ResourceTypeRecord[]]>(
      `UPSERT ${id} SET
        name = $name,
        table = $table,
        hasRecordId = $hasRecordId,
        bitMapping = $bitMapping,
        defaultGroups = $defaultGroups,
        parentResourceType = $parentResourceType,
        isSystem = $isSystem,
        scope = $scope,
        updatedAt = $now,
        createdAt = IF missing THEN $now ELSE createdAt END
      RETURN *`,
      { ...def, now }
    )
    return normalizeId(rows[0])!
  } finally {
    await closeSurreal(surreal)
  }
}

export async function seedResourceTypes(
  namespace: string,
  database: string,
  scope: 'platform' | 'tenant'
): Promise<void> {
  const defs = Object.values(RESOURCE_CATALOG).filter((r) => r.scope === scope)
  for (const def of defs) {
    await upsertResourceType(namespace, database, def)
  }
  for (const def of defs) {
    if (def.parentResourceType) {
      await createResourceParentEdge(namespace, database, def.name, def.parentResourceType)
    }
  }
}

export async function createResourceParentEdge(
  namespace: string,
  database: string,
  childName: string,
  parentName: string
): Promise<void> {
  const surreal = await getSurreal(namespace, database)
  try {
    await surreal.query(
      'RELATE $child->resource_parent->$parent',
      {
        child: new StringRecordId(resourceTypeRecordId(childName)),
        parent: new StringRecordId(resourceTypeRecordId(parentName)),
      }
    )
  } finally {
    await closeSurreal(surreal)
  }
}

export async function listResourceTypes(
  namespace: string,
  database: string
): Promise<ResourceTypeRecord[]> {
  const surreal = await getSurreal(namespace, database)
  try {
    const [rows] = await surreal.query<[ResourceTypeRecord[]]>('SELECT * FROM resource_types ORDER BY name')
    return normalizeIds(rows)
  } finally {
    await closeSurreal(surreal)
  }
}

export async function getResourceType(
  namespace: string,
  database: string,
  name: string
): Promise<ResourceTypeRecord | undefined> {
  const surreal = await getSurreal(namespace, database)
  try {
    const [rows] = await surreal.query<[ResourceTypeRecord[]]>(
      'SELECT * FROM type::record($id)',
      { id: resourceTypeRecordId(name) }
    )
    return normalizeId(rows[0])
  } finally {
    await closeSurreal(surreal)
  }
}
