import * as restate from '@restatedev/restate-sdk'
import { workflowObject } from './workflow.js'

restate.serve({ services: [workflowObject], port: 9080 })
