import { hashPassword } from 'shared/server'
import { createUserProfile, createAccount } from '../src/platform.js'
import { createMember } from '../src/tenant.js'

async function main() {
  const namespace = 'company_40376b02123641e9bfdb4c5860c6964f'
  const email = 'owner@testco.com'
  const profile = await createUserProfile({ name: 'Test Owner' })
  const account = await createAccount({
    provider: 'email',
    providerKey: email,
    credential: await hashPassword('password123'),
    profileId: profile.id
  })
  const member = await createMember(namespace, {
    email,
    profileId: profile.id,
    role: 'owner',
    status: 'active'
  })
  console.log(JSON.stringify({ profileId: profile.id, accountId: account.id, memberId: member.id }, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
