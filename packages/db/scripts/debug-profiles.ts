import { createUserProfile, getUserProfilesByIds } from '../src/platform.js'

async function main() {
  const profile = await createUserProfile({ name: 'Debug User' })
  console.log('created:', profile)
  const fetched = await getUserProfilesByIds([profile.id])
  console.log('fetched:', fetched)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
