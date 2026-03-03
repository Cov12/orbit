import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/site',
  '/site/(.*)',
  '/api/uploadthing',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/business/sign-in(.*)',
  '/business/sign-up(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Handle authentication for protected routes
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  // URL rewriting logic (same as before)
  const url = req.nextUrl
  const searchParams = url.searchParams.toString()
  const hostname = req.headers

  const pathWithSearchParams = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ''}`

  // If subdomain exists
  const customSubDomain = hostname
    .get('host')
    ?.split(`${process.env.NEXT_PUBLIC_DOMAIN}`)
    .filter(Boolean)[0]

  if (customSubDomain) {
    return NextResponse.rewrite(
      new URL(`/${customSubDomain}${pathWithSearchParams}`, req.url)
    )
  }

  // Auth routes redirect to Orbit Portal (centralized auth)
  const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'

  if (url.pathname === '/sign-in' || url.pathname.startsWith('/business/sign-in')) {
    const returnUrl = encodeURIComponent(`${url.origin}/business`)
    return NextResponse.redirect(new URL(`${PORTAL_URL}/sign-in?redirect_url=${returnUrl}`))
  }

  if (url.pathname === '/sign-up' || url.pathname.startsWith('/business/sign-up')) {
    const returnUrl = encodeURIComponent(`${url.origin}/business`)
    return NextResponse.redirect(new URL(`${PORTAL_URL}/sign-up?redirect_url=${returnUrl}`))
  }

  if (
    url.pathname === '/' ||
    (url.pathname === '/site' && url.host === process.env.NEXT_PUBLIC_DOMAIN)
  ) {
    return NextResponse.rewrite(new URL('/site', req.url))
  }

  if (
    url.pathname.startsWith('/business') ||
    url.pathname.startsWith('/subaccount')
  ) {
    return NextResponse.rewrite(new URL(`${pathWithSearchParams}`, req.url))
  }
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
