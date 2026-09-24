import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Orbit Drive Middleware — Portal JWT Auth
 *
 * Auth flow:
 * 1. Check for Portal JWT (orbit_token cookie)
 * 2. On failure → redirect to Portal /api/auth/refresh
 * 3. Portal handles authentication and redirects back with fresh JWT
 *
 * Drive has ZERO knowledge of what auth provider Portal uses.
 */

const PORTAL_TOKEN_COOKIE = 'orbit_token';

/** Routes that don't require authentication */
const PUBLIC_PATHS = new Set([
  '/auth/callback',
  '/api/health',
]);

const PUBLIC_PREFIXES = [
  '/_next',
  '/favicon',
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return true;

  // Public share downloads (token-based, no session needed)
  if (pathname.includes('/download') && pathname.includes('/api/drive/shares/')) return true;

  // Public share access (GET /api/drive/shares/[shareId])
  if (/^\/api\/drive\/shares\/[^/]+$/.test(pathname)) return true;

  return false;
}

/**
 * Get the public-facing origin.
 * Render resolves req.url to localhost:PORT internally.
 */
function getPublicOrigin(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'drive.orbit.example';
  return `${proto}://${host}`;
}

/**
 * Check if a Portal JWT cookie exists and hasn't expired.
 * Only decodes the base64 payload — no crypto in edge middleware.
 */
function hasValidPortalToken(req: NextRequest): boolean {
  let token = req.cookies.get(PORTAL_TOKEN_COOKIE)?.value;
  if (!token) {
    // Service-to-service (Atrium dashboard, WorkPipe, …): a Portal JWT forwarded as a
    // Bearer token instead of the browser cookie. Edge middleware can't do crypto, so it
    // only gates on presence + expiry here (same as the cookie path); the route handler's
    // verifyPortalToken does the real signature verification.
    const authz = req.headers.get('authorization');
    if (authz?.startsWith('Bearer ')) token = authz.slice(7);
  }
  if (!token) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.exp && payload.exp > Date.now() / 1000 - 30;
  } catch {
    return false;
  }
}

/**
 * Redirect to Portal for authentication.
 */
function redirectToPortal(req: NextRequest): NextResponse {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example';
  const publicOrigin = getPublicOrigin(req);
  const callbackUrl = `${publicOrigin}/auth/callback`;

  // API routes get 401 JSON instead of redirect
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required. Please sign in at portal.orbit.example' },
      { status: 401 }
    );
  }

  return NextResponse.redirect(
    new URL(`${portalUrl}/api/auth/refresh?redirect_uri=${encodeURIComponent(callbackUrl)}`)
  );
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes → pass through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Root → redirect to /drive if authenticated, else Portal
  if (pathname === '/') {
    if (hasValidPortalToken(req)) {
      return NextResponse.redirect(new URL('/drive', getPublicOrigin(req)));
    }
    return redirectToPortal(req);
  }

  // Protected routes: check Portal JWT
  if (hasValidPortalToken(req)) {
    return NextResponse.next();
  }

  return redirectToPortal(req);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
