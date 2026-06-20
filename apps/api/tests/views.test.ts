import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../src/app.js'
import { provisionCompanyNamespace } from 'db/provision'
import { getSurreal, closeSurreal } from 'db/client'
import { signAdminAccessTokenCookie } from './helpers.js'

const TEST_NS = `test_api_views_${Date.now()}`
const app = createApp()

describe('/api/views (admin scope)', () => {
  beforeAll(async () => {
    await provisionCompanyNamespace(TEST_NS)
  })

  afterAll(async () => {
    const surreal = await getSurreal()
    await surreal.query(`REMOVE NAMESPACE IF EXISTS ${TEST_NS}`)
    await closeSurreal(surreal)
  })

  const adminCookie = () =>
    `admin_access_token=${signAdminAccessTokenCookie('admin', 'admin@example.com')}`

  it('lists default views', async () => {
    const res = await app.request(`/api/admin/views/${TEST_NS}--main?table=members`, {
      headers: { Cookie: adminCookie() },
    })
    expect(res.status).toBe(200)
    const views = (await res.json()) as any[]
    expect(views.some((v: any) => v.table === 'members' && v.isDefault)).toBe(true)
  })

  it('gets default view for table with schema', async () => {
    const res = await app.request(`/api/admin/views/${TEST_NS}--main/default/members`, {
      headers: { Cookie: adminCookie() },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.view.table).toBe('members')
    expect(body.view.isDefault).toBe(true)
    expect(body.schema.table.name).toBe('members')
    expect(body.schema.columns.some((c: any) => c.name === 'email')).toBe(true)
  })

  it('creates a custom view', async () => {
    const res = await app.request(`/api/admin/views/${TEST_NS}--main`, {
      method: 'POST',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'members',
        type: 'table',
        name: 'Custom Members',
        config: {
          table: {
            columns: [
              { column: 'email', visible: true, width: 'auto' },
              { column: 'role', visible: false },
            ],
          },
        },
      }),
    })
    expect(res.status).toBe(201)
    const view = (await res.json()) as any
    expect(view.name).toBe('Custom Members')
    expect(view.id).toBeDefined()
  })

  it('updates a view', async () => {
    const createRes = await app.request(`/api/admin/views/${TEST_NS}--main`, {
      method: 'POST',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'members',
        type: 'table',
        name: 'Update Test',
        config: { table: { columns: [{ column: 'email', visible: true }] } },
      }),
    })
    const created = (await createRes.json()) as any

    const updateRes = await app.request(`/api/admin/views/${TEST_NS}--main/${encodeURIComponent(created.id)}`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Updated Name',
        config: { table: { columns: [{ column: 'email', visible: false }] } },
      }),
    })
    expect(updateRes.status).toBe(200)
    const updated = (await updateRes.json()) as any
    expect(updated.name).toBe('Updated Name')
    expect(updated.config.table.columns[0].visible).toBe(false)
  })

  it('deletes a view', async () => {
    const createRes = await app.request(`/api/admin/views/${TEST_NS}--main`, {
      method: 'POST',
      headers: { Cookie: adminCookie(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'members',
        type: 'table',
        name: 'To Delete',
        config: { table: { columns: [{ column: 'email', visible: true }] } },
      }),
    })
    const created = (await createRes.json()) as any

    const deleteRes = await app.request(`/api/admin/views/${TEST_NS}--main/${encodeURIComponent(created.id)}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie() },
    })
    expect(deleteRes.status).toBe(200)

    const getRes = await app.request(`/api/admin/views/${TEST_NS}--main/${encodeURIComponent(created.id)}`, {
      headers: { Cookie: adminCookie() },
    })
    expect(getRes.status).toBe(404)
  })
})
