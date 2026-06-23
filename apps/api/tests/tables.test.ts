import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../src/app.js'
import { provisionCompanyNamespace } from 'db/provision'
import { getSurreal, closeSurreal } from 'db/client'
import { signAdminAccessTokenCookie } from './helpers.js'

const TEST_NS = `test_api_tables_${Date.now()}`
const app = createApp()

describe('/api/tables (admin scope)', () => {
  beforeAll(async () => {
    await provisionCompanyNamespace(TEST_NS)
    const surreal = await getSurreal(TEST_NS, 'main')
    await surreal.query(`
      UPSERT members:one SET email = 'one@example.com', role = 'member', status = 'active';
      UPSERT members:two SET email = 'two@example.com', role = 'admin', status = 'inactive';
      UPSERT members:three SET email = 'three@example.com', role = 'member', status = 'active'
    `)
    await closeSurreal(surreal)
  })

  afterAll(async () => {
    const surreal = await getSurreal()
    await surreal.query(`REMOVE NAMESPACE IF EXISTS ${TEST_NS}`)
    await closeSurreal(surreal)
  })

  const adminCookie = () =>
    `admin_access_token=${signAdminAccessTokenCookie('admin', 'admin@example.com')}`

  it('lists user tables', async () => {
    const res = await app.request(`/api/admin/tables/${TEST_NS}--main`, {
      headers: { Cookie: adminCookie() },
    })
    expect(res.status).toBe(200)
    const tables = (await res.json()) as any[]
    expect(tables.some((t: any) => t.name === 'members')).toBe(true)
  })

  it('gets schema', async () => {
    const res = await app.request(`/api/admin/tables/${TEST_NS}--main/members`, {
      headers: { Cookie: adminCookie() },
    })
    expect(res.status).toBe(200)
    const schema = (await res.json()) as { columns: any[] }
    expect(schema.columns.some((c: any) => c.name === 'email')).toBe(true)
  })

  it('queries records', async () => {
    const res = await app.request(`/api/admin/tables/${TEST_NS}--main/members/query`, {
      method: 'POST',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 10 }),
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { records: any[]; total: number }
    expect(data.records).toHaveLength(3)
    expect(data.total).toBe(3)
  })

  it('filters records by status', async () => {
    const res = await app.request(`/api/admin/tables/${TEST_NS}--main/members/query`, {
      method: 'POST',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 1,
        pageSize: 10,
        filter: { op: 'and', conditions: [{ field: 'status', operator: 'eq', value: 'active' }] },
      }),
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { records: any[]; total: number }
    expect(data.records).toHaveLength(2)
    expect(data.total).toBe(2)
    expect(data.records.every((r) => r.status === 'active')).toBe(true)
  })

  it('sorts records by role descending', async () => {
    const res = await app.request(`/api/admin/tables/${TEST_NS}--main/members/query`, {
      method: 'POST',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 1,
        pageSize: 10,
        sort: [{ field: 'role', direction: 'desc' }],
      }),
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { records: any[] }
    expect(data.records[0].role).toBe('member')
    expect(data.records[2].role).toBe('admin')
  })

  it('projects selected columns', async () => {
    const res = await app.request(`/api/admin/tables/${TEST_NS}--main/members/query`, {
      method: 'POST',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 1,
        pageSize: 10,
        columns: [{ column: 'email', visible: true }],
      }),
    })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { records: any[] }
    expect(data.records[0]).toHaveProperty('id')
    expect(data.records[0]).toHaveProperty('email')
    expect(data.records[0]).not.toHaveProperty('role')
    expect(data.records[0]).not.toHaveProperty('status')
  })
})
