import { NextResponse } from 'next/server'

import { DRIVE_API_URL, driveBearer } from '@/lib/drive-service'

// GET /api/drive-proxy/files?subAccountId=  — proxy the sub-account-scoped Drive
// file list, forwarding the user's Portal JWT as a Bearer.
export async function GET(req: Request) {
  try {
    const token = await driveBearer()
    const subAccountId = new URL(req.url).searchParams.get('subAccountId') || ''
    const res = await fetch(
      `${DRIVE_API_URL}/api/drive/service/files?subAccountId=${encodeURIComponent(subAccountId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    )
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }
}
