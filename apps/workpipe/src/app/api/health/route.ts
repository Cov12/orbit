// Files read during this task:
// - src/app/api/internal/health/route.ts
// - src/app/api/internal/stats/route.ts
// - src/app/api/uploadthing/route.ts

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '1.0.0',
  })
}
