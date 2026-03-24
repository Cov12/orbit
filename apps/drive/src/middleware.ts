import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/api/drive(.*)',
]);

const isApiRoute = createRouteMatcher([
  '/api(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const url = new URL(req.url);

  // Allow public share downloads (no auth required)
  if (url.pathname.includes('/download') && url.searchParams.has('token')) {
    return;
  }

  // Allow public share access (GET /api/drive/shares/[shareId])
  if (url.pathname.match(/^\/api\/drive\/shares\/[^/]+$/) && req.method === 'GET') {
    return;
  }

  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      // Return JSON 401 for API routes (called by frontend JS)
      if (isApiRoute(req)) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required. Please sign in at portal.orbit.example' },
          { status: 401 }
        );
      }
      // Redirect browser requests to Portal sign-in
      const signInUrl = new URL('https://portal.orbit.example/sign-in');
      signInUrl.searchParams.set('redirect_url', req.url);
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
