'use server'

import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'

export type AuthUser = {
  id: string
  email: string
  name: string
  avatar: string
}

const mapClerkUser = async (): Promise<AuthUser | null> => {
  const user = await currentUser()

  if (!user) {
    return null
  }

  const email = user.emailAddresses[0]?.emailAddress ?? ''
  const name =
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
    user.username ||
    email

  return {
    id: user.id,
    email,
    name,
    avatar: user.imageUrl ?? '',
  }
}

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  return mapClerkUser()
}

export const requireAuth = async (): Promise<AuthUser> => {
  const user = await mapClerkUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  return user
}

export const getAuthContext = async (): Promise<{
  userId: string | null
  orgId: string | null
}> => {
  const { userId, orgId } = await auth()

  return {
    userId,
    orgId: orgId ?? null,
  }
}

export const getAuthAdmin = async () => {
  return clerkClient()
}
