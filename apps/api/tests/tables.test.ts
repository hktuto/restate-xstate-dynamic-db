import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../src/app.js'
import { provisionCompanyNamespace } from 'db/provision'
import { getSurreal, closeSurreal } from 'db/client'
import { signAdminSessionCookie } from './helpers.js'

const TEST_NS = `test_api_tables_${Date.now()}`
const app = createApp()

describe('/api/tables (admin scope)', () => {
  beforeAll(async () => {
    await provisionCompanyNamespace(TEST_NS)
    const surreal = await getSurreal(TEST_NS, 'main')
    await surreal.query(`UPSERT members:one SET email = 'test@example.com', role = 'admin', status = 'active'`)
    await closeSurreal(surreal)
  })

  afterAll(async () => {
    const surreal = await getSurreal()
    await surreal.query(`REMOVE NAMESPACE IF EXISTS ${TEST_NS}`)
    await closeSurreal(surreal)
  })

  const adminCookie = () =>
    `admin_session=${signAdminSessionCookie('admin', 'admin@example.com')}`

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
    const data = (await res.json()) as { records: any[] }
    expect(data.records).toHaveLength(1)
  })
})
