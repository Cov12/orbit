import 'server-only'
import { cookies } from 'next/headers'

import { PORTAL_TOKEN_COOKIE } from './portal-jwt'

// Base URL of Orbit Drive's API + the logged-in user's Portal JWT, forwarded as a
// Bearer to Drive's sub-account-scoped service endpoints (/api/drive/service/*).
// Server-only — used by the drive-proxy routes, never the client.
export const DRIVE_API_URL =
  process.env.DRIVE_API_URL || 'https://drive.orbit.example'

export async function driveBearer(): Promise<string> {
  const token = (await cookies()).get(PORTAL_TOKEN_COOKIE)?.value
  if (!token) throw new Error('UNAUTHENTICATED')
  return token
}
