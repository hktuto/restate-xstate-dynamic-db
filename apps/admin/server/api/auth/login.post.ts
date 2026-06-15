import { getSurreal, closeSurreal } from 'db'
import { comparePassword } from 'shared'
import { setAdminSession } from '#server/utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body || {}

  const surreal = await getSurreal('platform', 'admin')
  try {
    const [users] = await surreal.query<[any[]]>(
      'SELECT * FROM platform_users WHERE email = $email LIMIT 1',
      { email }
    )
    const user = users[0]
    if (!user || !(await comparePassword(password, user.password))) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
    }
    setAdminSession(event, { userId: user.id, email: user.email })
    return { ok: true }
  } finally {
    await closeSurreal(surreal)
  }
})
