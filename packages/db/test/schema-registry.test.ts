import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { provisionCompanyNamespace } from '../src/provision.js';
import {
  listTables,
  listUserTables,
  upsertTable,
  getTableSchema,
  syncTableSchemaFromRecords,
} from '../src/schema-registry.js';
import { getSurreal, closeSurreal } from '../src/client.js';

describe('schema-registry', () => {
  const testNs = `test_schema_${Date.now()}`;

  beforeAll(async () => {
    await provisionCompanyNamespace(testNs);
    const surreal = await getSurreal(testNs, 'main');
    await surreal.query(`
      UPSERT contacts:test SET name = 'Alice', age = 30, active = true, createdAt = time::now()
    `);
    await closeSurreal(surreal);
  });

  afterAll(async () => {
    const surreal = await getSurreal(testNs, 'main');
    await surreal.query(`REMOVE NAMESPACE IF EXISTS ${testNs}`);
    await closeSurreal(surreal);
  });

  it('upserts and lists a table', async () => {
    await upsertTable(testNs, 'main', { name: 'contacts', label: 'Contacts' });
    const tables = await listTables(testNs, 'main');
    expect(tables.some((t) => t.name === 'contacts')).toBe(true);
  });

  it('listUserTables excludes system tables', async () => {
    const tables = await listUserTables(testNs, 'main');
    expect(tables.some((t) => t.name.startsWith('_'))).toBe(false);
  });

  it('syncs schema from records', async () => {
    await syncTableSchemaFromRecords(testNs, 'main', 'contacts');
    const schema = await getTableSchema(testNs, 'main', 'contacts');
    expect(schema.table.name).toBe('contacts');
    const names = schema.columns.map((c) => c.name).sort();
    expect(names).toContain('name');
    expect(names).toContain('age');
    expect(names).toContain('active');
    expect(names).toContain('id');
    expect(names).toContain('createdAt');
  });
});
