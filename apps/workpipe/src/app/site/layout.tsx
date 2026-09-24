import React from 'react'

import Navigation from '@/components/site/navigation'
import { getCurrentUser } from '@/lib/auth'

const layout = async ({ children }: { children: React.ReactNode }) => {
  const authUser = await getCurrentUser()
  return (
    <main className="h-full">
      <Navigation user={authUser} />
      {children}
    </main>
  )
}

export default layout
