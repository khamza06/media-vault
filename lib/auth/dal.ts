import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { getAuthSession } from './session'

export const getCurrentUser = cache(async () => {
  const session = await getAuthSession()

  if (!session) {
    return null
  }

  return {
    accessToken: session.accessToken,
    email: session.user.email ?? null,
    id: session.user.id,
  }
})

export async function requireCurrentUser() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

export async function redirectIfAuthenticated() {
  const user = await getCurrentUser()

  if (user) {
    redirect('/')
  }
}
