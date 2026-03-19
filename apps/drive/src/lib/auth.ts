'use server'

import { auth, currentUser } from '@clerk/nextjs/server'

export type AuthUser = {
  id: string
  email: string
  name: string
  avatar: string
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const user = await currentUser()
  if (!user) return null

  return {
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress ?? '',
    name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username || '',
    avatar: user.imageUrl ?? '',
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function getAuthContext(): Promise<{
  userId: string | null
  orgId: string | null
}> {
  const { userId, orgId } = await auth()
  return { userId, orgId: orgId ?? null }
}
