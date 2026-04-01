import jwt from 'jsonwebtoken'

/**
 * Portal JWT verification for cross-app authentication.
 *
 * WorkPipe accepts JWTs issued by the Orbit Portal.
 * This is the ONLY auth interface with Portal — WorkPipe has
 * zero knowledge of what auth provider Portal uses internally.
 *
 * To swap auth providers: change Portal only. This file stays the same.
 */

export interface PortalJwtPayload {
  sub: string // Clerk user ID (or whatever provider Portal uses)
  org_id: string // Workspace ID
  org_slug: string // Workspace slug
  role: string // OWNER | ADMIN | MEMBER
  subscriptions: {
    plan: string
    status: string
  }[]
  app_access: string[] // ["WORKPIPE", "DRIVE", "ATRIUM"]
  iat: number
  exp: number
}

const JWT_SECRET = process.env.JWT_SECRET

/**
 * Verify a Portal-issued JWT token.
 * Returns the decoded payload or null if invalid/expired.
 */
export function verifyPortalToken(token: string): PortalJwtPayload | null {
  if (!JWT_SECRET) {
    console.error('[Portal JWT] JWT_SECRET not configured')
    return null
  }

  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as PortalJwtPayload
  } catch {
    return null
  }
}

/**
 * Check if a Portal JWT payload grants access to WorkPipe.
 */
export function hasWorkPipeAccess(payload: PortalJwtPayload): boolean {
  return payload.app_access.includes('WORKPIPE')
}

/**
 * Cookie name for the Portal JWT token.
 */
export const PORTAL_TOKEN_COOKIE = 'orbit_token'
