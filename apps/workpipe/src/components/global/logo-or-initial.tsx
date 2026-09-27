'use client'

import { useEffect, useState } from 'react'

import Image from 'next/image'

import { cn } from '@/lib/utils'

type Props = {
  src?: string | null
  name?: string | null
  alt: string
  className?: string
  initialClassName?: string
}

// The logo when there is one and it loads; otherwise the name's first letter. Render inside
// a sized, relatively positioned container (the image uses `fill`).
export default function LogoOrInitial({ src, name, alt, className, initialClassName }: Props) {
  const [failed, setFailed] = useState(false)
  // A new logo gets a fresh attempt (e.g. after switching accounts).
  useEffect(() => setFailed(false), [src])
  const initial = (name?.trim().charAt(0) || '?').toUpperCase()

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md bg-primary/15 font-semibold text-primary',
          initialClassName
        )}
      >
        {initial}
      </div>
    )
  }

  return <Image src={src} alt={alt} fill className={className} onError={() => setFailed(true)} />
}
