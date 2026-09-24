'use client'

import { useEffect } from 'react'

/**
 * WorkPipe Sign-Up — Redirects to Orbit Portal
 *
 * Account creation is centralized through the Orbit Portal.
 * Users create their account + subscription on the Portal,
 * then access WorkPipe through their Portal dashboard.
 */
const Page = () => {
  useEffect(() => {
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
    const returnUrl = encodeURIComponent(window.location.origin + '/business')
    window.location.href = `${portalUrl}/sign-up?redirect_url=${returnUrl}`
  }, [])

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      <p className="text-muted-foreground text-sm">Redirecting to sign up...</p>
    </div>
  )
}

export default Page
