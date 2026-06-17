import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BenchmarkResult } from './runner.js'

interface ReportRow extends BenchmarkResult {
  scenario: string
  group: string
}

const __filename = fileURLToPath(import.meta.url)
const root = resolve(__filename, '..', '..', '..', '..', '..')

function writeAtomic(filePath: string, content: string) {
  const tmp = `${filePath}.tmp`
  writeFileSync(tmp, content)
  renameSync(tmp, filePath)
}

export function writeReport(rows: ReportRow[], durationSeconds: number, concurrencyLevels: number[]) {
  const generatedAt = new Date().toISOString()

  const mdPath = resolve(root, 'docs', '60-Development', 'SurrealDB Performance Benchmark.md')
  mkdirSync(dirname(mdPath), { recursive: true })

  let createdDate = generatedAt.slice(0, 10)
  try {
    const existing = readFileSync(mdPath, 'utf-8')
    const match = existing.match(/created:\s*(\S+)/)
    if (match?.[1]) createdDate = match[1]
  } catch {
    // file does not exist yet
  }

  const md = generateMarkdown(rows, durationSeconds, concurrencyLevels, generatedAt, createdDate)
  writeAtomic(mdPath, md)

  const jsonDir = resolve(root, 'packages', 'db', 'benchmark-results')
  mkdirSync(jsonDir, { recursive: true })
  const jsonPath = resolve(jsonDir, 'latest.json')
  writeAtomic(
    jsonPath,
    JSON.stringify(
      {
        generatedAt,
        durationSeconds,
        concurrencyLevels,
        results: rows,
      },
      null,
      2,
    ),
  )

  console.log(`Wrote Markdown report to ${mdPath}`)
  console.log(`Wrote JSON results to ${jsonPath}`)
}

function generateMarkdown(
  rows: ReportRow[],
  durationSeconds: number,
  concurrencyLevels: number[],
  generatedAt: string,
  createdDate: string,
): string {
  const groups = Array.from(new Set(rows.map((r) => r.group)))
  const sections = groups
    .map((group) => {
      const groupRows = rows.filter((r) => r.group === group)
      const scenarios = Array.from(new Set(groupRows.map((r) => r.scenario)))
      const table = [
        `## ${group}`,
        '',
        '| Scenario | Concurrency | Ops/sec | p50 (ms) | p95 (ms) | p99 (ms) | Errors |',
        '|----------|------------:|--------:|---------:|---------:|---------:|-------:|',
        ...scenarios.flatMap((scenario) => {
          const scenarioRows = groupRows
            .filter((r) => r.scenario === scenario)
            .sort((a, b) => a.concurrency - b.concurrency)
          return scenarioRows.map(
            (r) =>
              `| ${scenario} | ${r.concurrency} | ${r.opsPerSecond.toFixed(2)} | ${r.latencyMs.p50.toFixed(2)} | ${r.latencyMs.p95.toFixed(2)} | ${r.latencyMs.p99.toFixed(2)} | ${r.errors} |`,
          )
        }),
      ].join('\n')
      return table
    })
    .join('\n\n')

  return `---
title: SurrealDB Performance Benchmark
type: note
status: done
area: db
created: ${createdDate}
updated: ${generatedAt.slice(0, 10)}
related:
  - [[Benchmarking]]
  - [[db package]]
---

# SurrealDB Performance Benchmark

> Generated automatically by \`packages/db/scripts/benchmark.ts\`.

The benchmark exercises the public helpers from [[db package]].

- **Duration per concurrency level:** ${durationSeconds}s
- **Concurrency levels:** ${concurrencyLevels.join(', ')}
- **Generated at:** ${generatedAt}

${sections}
`
}
