import React from 'react'

import Navigation from '@/components/site/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AuthProvider, dark } from '@/lib/auth-client'

// Force dynamic rendering to support Clerk's headers access in Next.js 15
// TODO: Upgrade to @clerk/nextjs v6+ for native Next.js 15 support
export const dynamic = 'force-dynamic'

const layout = async ({ children }: { children: React.ReactNode }) => {
  const authUser = await getCurrentUser()
  return (
    <AuthProvider appearance={{ baseTheme: dark }}>
      <main className="h-full">
        <Navigation user={authUser} />
        {children}
      </main>
    </AuthProvider>
  )
}

export default layout
