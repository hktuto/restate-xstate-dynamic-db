import { getSurreal, closeSurreal } from './client.js'

async function seed() {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE workflow_designs WHERE name = "provisionCompany"')

    const workflowConfig = {
      id: 'provisionCompany',
      initial: 'activating',
      states: {
        activating: {
          meta: {
            action: 'updateRecord',
            params: {
              table: 'companies',
              fields: { status: 'active' }
            },
            outputKey: 'updatedCompany'
          },
          on: {
            ok: { target: 'done' },
            error: { target: 'failed' }
          }
        },
        done: { type: 'final' },
        failed: { type: 'final' }
      }
    }

    await surreal.query(
      'CREATE workflow_designs CONTENT $data',
      {
        data: {
          name: 'provisionCompany',
          xstateConfig: workflowConfig,
          starts: [
            { type: 'db_trigger', startState: 'activating', options: { tableName: 'companies', event: 'create' } }
          ]
        }
      }
    )

    console.log('Workflow design seeded')
  } finally {
    await closeSurreal(surreal)
  }
}

seed().catch((err) => {
  console.error('Workflow design seed failed:', err)
  process.exit(1)
})
