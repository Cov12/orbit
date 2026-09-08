import { NextResponse } from 'next/server'

import {
  MAX_BODY_BYTES,
  clientIpFromHeaders,
  ingestLeadSubmission,
} from '@/lib/lead-ingest'

/**
 * Public lead-capture endpoint (issue #54 phase 3).
 *
 * Unauthenticated by design: a form embedded on any site posts here, and the
 * `formKey` path segment is the only credential. Everything that decides what
 * is written lives in `@/lib/lead-ingest` — notably, the sub-account comes
 * from the resolved LeadForm row, never from the request body.
 */

/**
 * CORS for third-party embeds. The origin is reflected rather than wildcarded
 * so the headers stay valid if a form ever posts with credentials; the scope
 * is this route only (mirrors the OPTIONS handler on the Stripe checkout
 * route), and only POST/OPTIONS are offered.
 */
const corsHeaders = (request: Request): Record<string, string> => ({
  'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  Vary: 'Origin',
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formKey: string }> }
) {
  const headers = corsHeaders(request)

  try {
    // Reject oversized bodies before buffering them into memory. The ingest
    // layer re-checks the actual byte length (Content-Length can be absent or
    // wrong); this just avoids reading a huge body on an anonymous endpoint.
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' },
        { status: 413, headers }
      )
    }

    const { formKey } = await params
    const result = await ingestLeadSubmission({
      formKey,
      rawBody: await request.text(),
      ipAddress: clientIpFromHeaders(request.headers),
      userAgent: request.headers.get('user-agent'),
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status, headers }
      )
    }

    return NextResponse.json(result.body, { status: result.status, headers })
  } catch (err) {
    console.error('🔴 Lead form submit failed', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500, headers }
    )
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: { ...corsHeaders(request), 'Access-Control-Max-Age': '86400' },
  })
}
