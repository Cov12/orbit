import React from 'react'

import { AuthProvider, dark } from '@/lib/auth-client'

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthProvider appearance={{ baseTheme: dark }}>{children}</AuthProvider>
  )
}

export default Layout
