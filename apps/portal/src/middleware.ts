import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/apps(.*)',
  '/settings(.*)',
  '/api/auth/token(.*)',
  '/api/workspaces(.*)',
]);

/**
 * Get the public-facing URL base.
 * Render sets x-forwarded-host to the real hostname,
 * but req.url resolves to localhost:PORT internally.
 */
function getPublicUrl(req: Request): string {
  const proto = (req.headers as any).get?.('x-forwarded-proto') || 'https';
  const host = (req.headers as any).get?.('x-forwarded-host') || (req.headers as any).get?.('host') || 'portal.orbit.example';
  return `${proto}://${host}`;
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      const publicBase = getPublicUrl(req);
      const pathname = new URL(req.url).pathname + new URL(req.url).search;
      const signInUrl = new URL('/sign-in', publicBase);
      signInUrl.searchParams.set('redirect_url', `${publicBase}${pathname}`);
      return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
