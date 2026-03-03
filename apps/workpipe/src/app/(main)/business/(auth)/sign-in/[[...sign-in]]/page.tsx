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
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
    const returnUrl = encodeURIComponent(window.location.origin + '/business')
    window.location.href = `${portalUrl}/sign-in?redirect_url=${returnUrl}`
  }, [])

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      <p className="text-muted-foreground text-sm">Redirecting to login...</p>
    </div>
  )
}

export default Page
