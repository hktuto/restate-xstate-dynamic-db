import { platformScenarios, tenantScenarios } from './benchmark/scenarios.js'
import { runBenchmark } from './benchmark/runner.js'
import { writeReport } from './benchmark/report.js'

const CONCURRENCY_LEVELS = [1, 10, 50, 100]
const DURATION_MS = 5000
const WARMUP_MS = 1000

async function main() {
  const allScenarios = [...platformScenarios, ...tenantScenarios]
  const results = []

  for (const scenario of allScenarios) {
    for (const concurrency of CONCURRENCY_LEVELS) {
      console.log(`[${scenario.group}] ${scenario.name} @ ${concurrency} clients...`)
      const result = await runBenchmark(scenario, concurrency, DURATION_MS, WARMUP_MS)
      results.push({ scenario: scenario.name, group: scenario.group, ...result })
    }
  }

  writeReport(results, DURATION_MS / 1000, CONCURRENCY_LEVELS)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
