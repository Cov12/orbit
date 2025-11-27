import React from 'react'

import { ClerkProvider } from '@clerk/nextjs'
import { currentUser } from '@clerk/nextjs/server'
import { dark } from '@clerk/themes'

import Navigation from '@/components/site/navigation'

// Force dynamic rendering to support Clerk's headers access in Next.js 15
// TODO: Upgrade to @clerk/nextjs v6+ for native Next.js 15 support
export const dynamic = 'force-dynamic'

const layout = async ({ children }: { children: React.ReactNode }) => {
  const authUser = await currentUser()
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <main className="h-full">
        <Navigation user={authUser} />
        {children}
      </main>
    </ClerkProvider>
  )
}

export default layout
