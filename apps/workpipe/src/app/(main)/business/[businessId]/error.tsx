'use client'

import { useEffect } from 'react'

import Link from 'next/link'

import { Button } from '@/components/ui/button'

/**
 * Generic safety net for unexpected server errors under /business/[businessId].
 *
 * The expected org-boundary case (ForbiddenError) is handled server-side in
 * layout.tsx, where the error is still typed — Next.js scrubs error messages in
 * production, so all this boundary ever receives is a generic message plus a
 * digest. It is deliberately not relied on for that path.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Business page error:', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-muted-foreground">
        We couldn&apos;t load this workspace. Try again, or head back to your
        businesses.
      </p>
      {error.digest && (
        <p className="text-sm text-muted-foreground">Digest: {error.digest}</p>
      )}
      <div className="flex items-center gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/business">Back to businesses</Link>
        </Button>
      </div>
    </div>
  )
}
