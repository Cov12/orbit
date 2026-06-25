import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { PORTAL_TOKEN_COOKIE } from '@/lib/portal-jwt'

export const runtime = 'nodejs'

const DRIVE_API_URL = process.env.DRIVE_API_URL || 'https://drive.orbit.example'

/**
 * POST /api/branding/upload  (multipart form field: `file`)
 *
 * Same-origin proxy that forwards an image upload to Orbit Drive's public-asset
 * endpoint. The Portal JWT lives in an httpOnly cookie that the browser can't
 * read (and wouldn't send cross-origin to Drive), so the client uploads here
 * and we attach the JWT as a Bearer server-side. Drive stores the file in the
 * public branding bucket and returns its stable URL.
 *
 * Returns: { url }
 *
 * Error responses carry a `stage` field so a 401 can be traced to the proxy
 * (no cookie) vs. Drive (rejected the Bearer) — both otherwise look identical.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(PORTAL_TOKEN_COOKIE)?.value
  if (!token) {
    console.error(
      '[Branding] no orbit_token cookie at proxy; cookies present:',
      cookieStore.getAll().map(c => c.name)
    )
    return NextResponse.json(
      { error: 'Unauthorized', stage: 'proxy:no-token' },
      { status: 401 }
    )
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'No file provided', stage: 'proxy:no-file' },
      { status: 400 }
    )
  }

  const forwarded = new FormData()
  forwarded.append('file', file)

  // Decode the JWT org_id (no verification — Drive verifies). Drive resolves the
  // org from DB memberships and needs X-Org-Id to disambiguate multi-org users.
  let orgId: string | undefined
  try {
    const claims = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString()
    )
    if (typeof claims.org_id === 'string') orgId = claims.org_id
  } catch {
    /* leave undefined — single-org users don't need it */
  }

  let res: Response
  try {
    res = await fetch(`${DRIVE_API_URL}/api/drive/public`, {
      method: 'POST',
      headers: {
        // Forward the token as BOTH a cookie (Drive's primary, proven auth
        // path) and a Bearer (for non-cookie consumers). The Cookie header is
        // never stripped in transit, and Drive reads it via its existing
        // getPortalUser cookie flow — no reliance on header() Bearer parsing.
        // Node's server-side fetch permits setting Cookie (browsers don't).
        Cookie: `${PORTAL_TOKEN_COOKIE}=${token}`,
        Authorization: `Bearer ${token}`,
        ...(orgId ? { 'X-Org-Id': orgId } : {}),
      },
      body: forwarded,
      cache: 'no-store',
    })
  } catch (err) {
    console.error('[Branding] Drive upload request failed:', err)
    return NextResponse.json(
      {
        error: 'Upload failed, please try again',
        stage: 'proxy:drive-fetch-threw',
      },
      { status: 502 }
    )
  }

  const data = (await res.json().catch(() => ({}))) as {
    url?: string
    error?: string
  }
  if (!res.ok) {
    console.error('[Branding] Drive returned', res.status, data)
    return NextResponse.json(
      {
        error: data.error || 'Upload failed',
        stage: 'drive',
        driveStatus: res.status,
      },
      { status: res.status }
    )
  }
  return NextResponse.json({ url: data.url })
}
