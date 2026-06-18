export function getEnv() {
  const sessionSecret = process.env.SESSION_SECRET
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET is required')
  }
  const port = Number(process.env.API_PORT ?? '3002')
  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000'
  const adminUrl = process.env.ADMIN_URL ?? 'http://localhost:3001'
  return { sessionSecret, port, webUrl, adminUrl }
}
