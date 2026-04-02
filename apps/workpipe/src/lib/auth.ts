'use server'

import { cookies } from 'next/headers'
import { verifyPortalToken, PORTAL_TOKEN_COOKIE } from '@/lib/portal-jwt'
import type { PortalJwtPayload } from '@/lib/portal-jwt'

/**
 * WorkPipe Auth Wrapper
 *
 * All authentication goes through Orbit Portal JWTs.
 * WorkPipe has zero knowledge of what auth provider Portal uses.
 *
 * To swap auth providers: change Portal only. This file stays the same.
 */

export type AuthUser = {
  id: string
  email: string
  name: string
  avatar: string
  role: string
}

export type AuthContext = {
  userId: string | null
  orgId: string | null
  role: string | null
}

/**
 * Get user from Portal JWT cookie.
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
        email: payload.email || '',
        name: payload.name || '',
        avatar: '',
        role: payload.role || 'MEMBER',
      },
      payload,
    }
  } catch {
    return null
  }
}

/**
 * Get current user. Returns null if not authenticated.
 */
export const getCurrentUser = async (): Promise<AuthUser | null> => {
  const portal = await getPortalUser()
  return portal?.user ?? null
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
 * Get auth context (userId + orgId + role).
 */
export const getAuthContext = async (): Promise<AuthContext> => {
  const portal = await getPortalUser()
  if (portal) {
    return {
      userId: portal.payload.sub,
      orgId: portal.payload.org_id,
      role: portal.payload.role || 'MEMBER',
    }
  }
  return { userId: null, orgId: null, role: null }
}

/**
 * Stub for Clerk admin client.
 * Used by queries.ts for user metadata and invitations.
 * These operations are no-ops now — roles come from Portal JWT,
 * invitations will move to Portal API in the CLIENT role implementation.
 *
 * @deprecated Remove once queries.ts is refactored to use Portal API
 */
export const getAuthAdmin = async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noOp = (..._args: any[]) => {
    console.warn('[Auth] Clerk admin call skipped — using Portal JWT auth')
    return Promise.resolve({ data: [] } as any)
  }
  return {
    users: {
      updateUserMetadata: noOp,
      getUser: noOp,
      deleteUser: noOp,
    },
    invitations: {
      getInvitationList: noOp,
      createInvitation: noOp,
      revokeInvitation: noOp,
    },
  } as any
}

/**
 * Get the raw Portal JWT payload (for subscription/access checks).
 */
export const getPortalContext = async (): Promise<PortalJwtPayload | null> => {
  const portal = await getPortalUser()
  return portal?.payload ?? null
}
