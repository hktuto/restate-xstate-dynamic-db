import { describe, it, expect } from 'vitest'
import { permissionsRoutes } from './permissions.js'

const app = permissionsRoutes

describe('GET /actions', () => {
  it('returns compound action values for a valid resourceType', async () => {
    const res = await app.request('/actions?resourceType=user_group')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      resourceType: string
      actions: Array<{ action: string; value: number }>
    }
    expect(body.resourceType).toBe('user_group')
    expect(body.actions.map((a) => a.action)).toEqual([
      'view',
      'edit_info',
      'create',
      'delete',
      'add_member',
      'remove_member',
      'update_default_view_settings',
      'edit_schema',
      'manage_permissions',
    ])
    expect(body.actions.find((a) => a.action === 'create')?.value).toBe(5)
    expect(body.actions.find((a) => a.action === 'add_member')?.value).toBe(19)
  })

  it('returns 400 for an invalid resourceType', async () => {
    const res = await app.request('/actions?resourceType=not_a_resource')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Invalid or missing resourceType')
  })

  it('returns 400 when resourceType is missing', async () => {
    const res = await app.request('/actions')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Invalid or missing resourceType')
  })
})
