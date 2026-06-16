import { getSurreal, closeSurreal } from './client.js'

async function seed() {
  const surreal = await getSurreal('platform', 'admin')
  try {
    await surreal.query('DELETE triggers WHERE tableName = "companies" AND event = "create"')
    await surreal.query('DELETE workflows WHERE name = "provisionCompany"')

    const workflowConfig = {
      id: 'provisionCompany',
      initial: 'idle',
      states: {
        idle: {
          on: {
            create: { target: 'activating' }
          }
        },
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

    const [workflows] = await surreal.query<[any[]]>(
      'CREATE workflows CONTENT $data RETURN id',
      { data: { name: 'provisionCompany', xstateConfig: workflowConfig } }
    )
    const workflow = workflows[0]

    await surreal.query(
      'CREATE triggers CONTENT $data',
      { data: { tableName: 'companies', event: 'create', workflowId: workflow.id } }
    )

    console.log('Workflow and trigger seeded')
  } finally {
    await closeSurreal(surreal)
  }
}

seed().catch((err) => {
  console.error('Workflow seed failed:', err)
  process.exit(1)
})
