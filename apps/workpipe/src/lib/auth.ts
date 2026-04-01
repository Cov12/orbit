'use server'

import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { verifyPortalToken, PORTAL_TOKEN_COOKIE } from '@/lib/portal-jwt'
import type { PortalJwtPayload } from '@/lib/portal-jwt'

/**
 * WorkPipe Auth Wrapper
 *
 * Abstracts the auth source so the rest of the app doesn't care
 * whether the user came from Portal JWT or Clerk session.
 *
 * Priority:
 * 1. Portal JWT (orbit_token cookie) — primary, provider-agnostic
 * 2. Clerk session — legacy fallback
 *
 * When Clerk is fully decoupled, remove the Clerk fallback paths.
 * The AuthUser interface stays the same either way.
 */

export type AuthUser = {
  id: string
  email: string
  name: string
  avatar: string
}

export type AuthContext = {
  userId: string | null
  orgId: string | null
  source: 'portal' | 'clerk' | null
}

/**
 * Try to get user from Portal JWT cookie.
 */
const getPortalUser = async (): Promise<{
  user: AuthUser
  payload: PortalJwtPayload
} | null> => {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(PORTAL_TOKEN_COOKIE)?.value
    if (!token) return null

    const payload = verifyPortalToken(token)
    if (!payload) return null

    return {
      user: {
        id: payload.sub,
        email: '', // Portal JWT doesn't include email currently — can be added
        name: '', // Same — extend Portal JWT payload if needed
        avatar: '',
      },
      payload,
    }
  } catch {
    return null
  }
}

/**
 * Try to get user from Clerk session (legacy fallback).
 */
const getClerkUser = async (): Promise<AuthUser | null> => {
  try {
    const user = await currentUser()
    if (!user) return null

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
  } catch {
    return null
  }
}

/**
 * Get current user from any auth source.
 */
export const getCurrentUser = async (): Promise<AuthUser | null> => {
  // Priority 1: Portal JWT
  const portal = await getPortalUser()
  if (portal) return portal.user

  // Priority 2: Clerk (legacy)
  return getClerkUser()
}

/**
 * Require authentication. Throws if no user found.
 */
export const requireAuth = async (): Promise<AuthUser> => {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

/**
 * Get auth context (userId + orgId) from any source.
 */
export const getAuthContext = async (): Promise<AuthContext> => {
  // Priority 1: Portal JWT
  const portal = await getPortalUser()
  if (portal) {
    return {
      userId: portal.payload.sub,
      orgId: portal.payload.org_id,
      source: 'portal',
    }
  }

  // Priority 2: Clerk (legacy)
  try {
    const { userId, orgId } = await auth()
    return {
      userId,
      orgId: orgId ?? null,
      source: userId ? 'clerk' : null,
    }
  } catch {
    return { userId: null, orgId: null, source: null }
  }
}

/**
 * Get the raw Portal JWT payload (for subscription/access checks).
 * Returns null if user didn't come through Portal.
 */
export const getPortalContext = async (): Promise<PortalJwtPayload | null> => {
  const portal = await getPortalUser()
  return portal?.payload ?? null
}

/**
 * Get Clerk admin client (for user management).
 * This is the ONLY export that's Clerk-specific.
 * Mark for removal when Clerk is fully decoupled.
 * @deprecated Will be removed when auth provider is swapped.
 */
export const getAuthAdmin = async () => {
  return clerkClient()
}
