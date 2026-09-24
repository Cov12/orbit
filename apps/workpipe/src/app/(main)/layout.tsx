import React from 'react'

import { AuthProvider } from '@/lib/auth-client'

const Layout = ({ children }: { children: React.ReactNode }) => {
  return <AuthProvider>{children}</AuthProvider>
}

export default Layout
