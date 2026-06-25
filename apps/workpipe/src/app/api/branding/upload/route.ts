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
 */
export async function POST(req: Request) {
  const token = (await cookies()).get(PORTAL_TOKEN_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const forwarded = new FormData()
  forwarded.append('file', file)

  let res: Response
  try {
    res = await fetch(`${DRIVE_API_URL}/api/drive/public`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: forwarded,
      cache: 'no-store',
    })
  } catch (err) {
    console.error('[Branding] Drive upload request failed:', err)
    return NextResponse.json(
      { error: 'Upload failed, please try again' },
      { status: 502 }
    )
  }

  const data = (await res.json().catch(() => ({}))) as {
    url?: string
    error?: string
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error || 'Upload failed' },
      { status: res.status }
    )
  }
  return NextResponse.json({ url: data.url })
}
