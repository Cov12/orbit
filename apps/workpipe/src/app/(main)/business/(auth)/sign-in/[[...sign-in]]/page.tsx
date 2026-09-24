'use client'

import { useEffect } from 'react'

/**
 * WorkPipe Sign-In — Redirects to Orbit Portal
 *
 * Auth is centralized through the Orbit Portal (portal.orbit.example).
 * This page serves as a fallback redirect in case the middleware
 * redirect doesn't fire (e.g., client-side navigation).
 */
const Page = () => {
  useEffect(() => {
    const portalUrl =
      process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
    const callbackUrl = encodeURIComponent(
      window.location.origin + '/auth/callback'
    )
    window.location.href = `${portalUrl}/api/auth/refresh?redirect_uri=${callbackUrl}`
  }, [])

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
      <p className="text-sm text-muted-foreground">Redirecting to login...</p>
    </div>
  )
}

export default Page
