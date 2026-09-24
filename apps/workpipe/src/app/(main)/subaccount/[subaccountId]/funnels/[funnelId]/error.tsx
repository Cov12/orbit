'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('Funnel page error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-muted-foreground">
        Error: {error.message || 'Unknown error'}
      </p>
      {error.digest && (
        <p className="text-sm text-muted-foreground">
          Digest: {error.digest}
        </p>
      )}
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  )
}
