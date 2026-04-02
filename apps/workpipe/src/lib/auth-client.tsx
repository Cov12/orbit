'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Portal-aware auth client components.
 * Zero Clerk dependency — all auth flows go through Orbit Portal.
 */

/* ── AuthProvider (replaces ClerkProvider) ── */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/* ── dark theme stub (replaces @clerk/themes export) ── */
export const dark = {}

/* ── UserAvatar (replaces Clerk UserButton) ── */
export function UserAvatar() {
  const [open, setOpen] = useState(false)
  const [initials, setInitials] = useState('U')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Decode JWT payload to get user name/email for initials
    try {
      const cookie = document.cookie
        .split('; ')
        .find(c => c.startsWith('orbit_token='))
      if (cookie) {
        const token = cookie.split('=')[1]
        const payload = JSON.parse(atob(token.split('.')[1]))
        const name = payload.name || payload.email || 'U'
        setInitials(
          name
            .split(' ')
            .map((w: string) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
        )
      }
    } catch {
      // fallback
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const signOut = useCallback(() => {
    document.cookie =
      'orbit_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=lax'
    window.location.href = 'https://portal.orbit.example'
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white transition-opacity hover:opacity-80"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 min-w-[160px] rounded-md border border-border bg-background p-1 shadow-lg">
          <button
            onClick={signOut}
            className="w-full rounded-sm px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
