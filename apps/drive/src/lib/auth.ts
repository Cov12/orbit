'use server'

import { cookies } from 'next/headers'
import { verifyPortalToken, PORTAL_TOKEN_COOKIE } from '@/lib/portal-jwt'
import type { PortalJwtPayload } from '@/lib/portal-jwt'

/**
 * Orbit Drive Auth Wrapper
 *
 * All authentication goes through Orbit Portal JWTs.
 * Drive has zero knowledge of what auth provider Portal uses.
 */

export type AuthUser = {
  id: string
  email: string
  name: string
  avatar: string
  orgId: string
  role: string
}

/**
 * Get user from Portal JWT cookie.
 */
async function getPortalUser(): Promise<{
  user: AuthUser
  payload: PortalJwtPayload
} | null> {
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
        orgId: payload.org_id,
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
export async function getCurrentUser(): Promise<AuthUser | null> {
  const portal = await getPortalUser()
  return portal?.user ?? null
}

/**
 * Require authentication. Throws if no user found.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

/**
 * Get auth context (userId + orgId).
 */
export async function getAuthContext(): Promise<{
  userId: string | null
  orgId: string | null
}> {
  const portal = await getPortalUser()
  if (portal) {
    return {
      userId: portal.payload.sub,
      orgId: portal.payload.org_id,
    }
  }
  return { userId: null, orgId: null }
}

/**
 * Get the raw Portal JWT payload.
 */
export async function getPortalContext(): Promise<PortalJwtPayload | null> {
  const portal = await getPortalUser()
  return portal?.payload ?? null
}
