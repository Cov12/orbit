import { NextResponse } from 'next/server'

import { DRIVE_API_URL, driveBearer } from '@/lib/drive-service'

// DELETE /api/drive-proxy/files/[fileId]?subAccountId=  — proxy a scoped delete.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const token = await driveBearer()
    const { fileId } = await params
    const subAccountId = new URL(req.url).searchParams.get('subAccountId') || ''
    const res = await fetch(
      `${DRIVE_API_URL}/api/drive/service/files/${fileId}?subAccountId=${encodeURIComponent(subAccountId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    )
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }
}
