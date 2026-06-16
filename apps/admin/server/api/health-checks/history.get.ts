import { listHealthCheckHistoryForService, type HealthCheckService } from 'db/health-checks'
import { requireAdminSession } from '#server/utils/session'

const DEFAULT_LIMIT = 20
const VALID_SERVICES: HealthCheckService[] = [
  'surrealdb',
  'restate',
  'workflow-runtime',
  'web-api'
]

export default defineEventHandler(async (event) => {
  requireAdminSession(event)

  const query = getQuery(event)
  const service = query.service

  if (typeof service !== 'string' || !VALID_SERVICES.includes(service as HealthCheckService)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing or invalid service query parameter'
    })
  }

  const limit = parseInt(String(query.limit ?? DEFAULT_LIMIT), 10)
  if (!Number.isFinite(limit) || limit <= 0 || Number.isNaN(limit)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid limit query parameter'
    })
  }

  const history = await listHealthCheckHistoryForService(service as HealthCheckService, limit)

  return {
    service: service as HealthCheckService,
    limit,
    history
  }
})
