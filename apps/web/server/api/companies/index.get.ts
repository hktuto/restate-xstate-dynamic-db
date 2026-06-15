import { listCompanies } from 'db/platform'

export default defineEventHandler(async () => {
  return listCompanies()
})
