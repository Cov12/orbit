import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/api/drive(.*)',
]);

const isApiRoute = createRouteMatcher([
  '/api(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public share downloads (no auth required)
  const url = new URL(req.url);
  if (url.pathname.includes('/download') && url.searchParams.has('token')) {
    return;
  }

  // Allow public share access (GET /api/drive/shares/[shareId])
  if (url.pathname.match(/^\/api\/drive\/shares\/[^/]+$/) && req.method === 'GET') {
    return;
  }

  if (isProtectedRoute(req)) {
    try {
      await auth.protect();
    } catch {
      // Return JSON 401 for API routes instead of Clerk's HTML redirect
      if (isApiRoute(req)) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }
      throw new Error('Unauthorized');
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
