import { NextResponse } from 'next/server'

import { DRIVE_API_URL, driveBearer } from '@/lib/drive-service'

/**
 * POST /api/drive-proxy/upload  (multipart: file, subAccountId)
 *
 * Full server-side upload to Drive so the browser never talks to R2 directly
 * (no cross-origin PUT / no R2 CORS dependency):
 *   1. init   → Drive /service/upload returns a presigned R2 PUT url
 *   2. PUT    → this server streams the bytes to R2
 *   3. confirm→ Drive /service/files/[id] marks it ACTIVE
 * The user's Portal JWT is forwarded as a Bearer; the sub-account is validated
 * (fail-closed) on the Drive side.
 */
export async function POST(req: Request) {
  try {
    const token = await driveBearer()
    const form = await req.formData()
    const file = form.get('file')
    const subAccountId = String(form.get('subAccountId') || '')

    if (!(file instanceof File) || !subAccountId) {
      return NextResponse.json(
        { error: 'file and subAccountId are required' },
        { status: 400 }
      )
    }

    const mimeType = file.type || 'application/octet-stream'

    // 1. init
    const initRes = await fetch(`${DRIVE_API_URL}/api/drive/service/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subAccountId,
        name: file.name,
        mimeType,
        size: file.size,
      }),
      cache: 'no-store',
    })
    if (!initRes.ok) {
      const detail = await initRes.json().catch(() => ({}))
      return NextResponse.json(detail, { status: initRes.status })
    }
    const { fileId, uploadUrl } = await initRes.json()

    // 2. PUT bytes to R2 (server-to-server)
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: await file.arrayBuffer(),
    })
    if (!putRes.ok) {
      return NextResponse.json(
        { error: 'Upload to storage failed' },
        { status: 502 }
      )
    }

    // 3. confirm
    const confirmRes = await fetch(
      `${DRIVE_API_URL}/api/drive/service/files/${fileId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subAccountId }),
        cache: 'no-store',
      }
    )
    if (!confirmRes.ok) {
      return NextResponse.json(
        { error: 'Could not finalize the upload' },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, fileId })
  } catch {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }
}
