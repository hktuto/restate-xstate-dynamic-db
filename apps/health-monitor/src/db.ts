import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { HealthCheckInput, HealthCheckRecord, HealthCheckService, HealthCheckStatus } from './types.js'

const DEFAULT_DB_PATH = './data/health-monitor.sqlite'

function getDbPath(): string {
  return process.env.HEALTH_MONITOR_DB_PATH || DEFAULT_DB_PATH
}

function ensureDir(path: string): void {
  const dir = dirname(path)
  if (dir && dir !== '.') {
    mkdirSync(dir, { recursive: true })
  }
}

function initDb(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT NOT NULL,
      status TEXT NOT NULL,
      checkedAt TEXT NOT NULL,
      responseTimeMs INTEGER NOT NULL,
      message TEXT,
      details TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_health_checks_service_checkedAt ON health_checks (service, checkedAt);
    CREATE INDEX IF NOT EXISTS idx_health_checks_checkedAt ON health_checks (checkedAt);
  `)
}

let db: Database | undefined

export function getDatabase(): Database {
  if (!db) {
    const path = getDbPath()
    ensureDir(path)
    const newDb = new Database(path)
    try {
      initDb(newDb)
      db = newDb
    } catch (err) {
      newDb.close()
      throw err
    }
  }
  return db
}

export function closeDatabase(): void {
  db?.close()
  db = undefined
}

interface HealthCheckRow {
  id: number
  service: string
  status: string
  checkedAt: string
  responseTimeMs: number
  message: string | null
  details: string | null
}

function rowToRecord(row: HealthCheckRow): HealthCheckRecord {
  return {
    id: row.id,
    service: row.service as HealthCheckService,
    status: row.status as HealthCheckStatus,
    checkedAt: row.checkedAt,
    responseTimeMs: row.responseTimeMs,
    message: row.message ?? undefined,
    details: row.details ? (JSON.parse(row.details) as Record<string, unknown>) : undefined,
  }
}

export function createHealthCheck(input: HealthCheckInput): HealthCheckRecord {
  const database = getDatabase()
  const details = input.details === undefined ? null : JSON.stringify(input.details)
  const result = database.query<
    HealthCheckRow,
    {
      $service: string
      $status: string
      $checkedAt: string
      $responseTimeMs: number
      $message: string | null
      $details: string | null
    }
  >(`
    INSERT INTO health_checks (service, status, checkedAt, responseTimeMs, message, details)
    VALUES ($service, $status, $checkedAt, $responseTimeMs, $message, $details)
    RETURNING id, service, status, checkedAt, responseTimeMs, message, details
  `).get({
    $service: input.service,
    $status: input.status,
    $checkedAt: input.checkedAt,
    $responseTimeMs: input.responseTimeMs,
    $message: input.message ?? null,
    $details: details,
  })

  if (!result) throw new Error('Failed to insert health check')
  return rowToRecord(result)
}

export function listLatestHealthChecks(): HealthCheckRecord[] {
  const database = getDatabase()
  const rows = database.query<HealthCheckRow, []>(`
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY service
          ORDER BY checkedAt DESC, id DESC
        ) AS rn
      FROM health_checks
    )
    SELECT id, service, status, checkedAt, responseTimeMs, message, details
    FROM ranked
    WHERE rn = 1
    ORDER BY checkedAt DESC
  `).all()
  return rows.map(rowToRecord)
}

export function listHealthCheckHistory(service: HealthCheckService, limit: number): HealthCheckRecord[] {
  const database = getDatabase()
  const rows = database.query<HealthCheckRow, { $service: string; $limit: number }>(`
    SELECT id, service, status, checkedAt, responseTimeMs, message, details
    FROM health_checks
    WHERE service = $service
    ORDER BY checkedAt DESC
    LIMIT $limit
  `).all({ $service: service, $limit: limit })
  return rows.map(rowToRecord)
}

export function pruneHealthChecksByAge(service: HealthCheckService, retentionMs: number): void {
  const database = getDatabase()
  const cutoff = new Date(Date.now() - retentionMs).toISOString()
  database
    .query<unknown, { $service: string; $cutoff: string }>(
      'DELETE FROM health_checks WHERE service = $service AND checkedAt < $cutoff',
    )
    .run({ $service: service, $cutoff: cutoff })
}
