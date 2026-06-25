'use client'

import React, { useRef, useState } from 'react'

import { X } from 'lucide-react'

import { Button } from '../ui/button'

type Props = {
  // Kept for call-site compatibility; the destination (Orbit Drive public bucket)
  // is the same for all kinds, so this is now just a semantic hint.
  apiEndpoint: 'businessLogo' | 'avatar' | 'subaccountLogo'
  onChange: (url?: string) => void
  value?: string
}

const MAX_BYTES = 4 * 1024 * 1024 // 4MB

/**
 * Image uploader backed by Orbit Drive's public branding bucket (via the
 * same-origin /api/branding/upload proxy). Replaces the previous UploadThing
 * dropzone. Drag-or-click → upload → preview → remove, with visible errors.
 */
const FileUpload = ({ onChange, value }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const upload = async (file?: File | null) => {
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be under 4MB.')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/branding/upload', {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onChange(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (value) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="relative h-40 w-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="uploaded image"
            className="h-full w-full object-contain"
          />
        </div>
        <Button onClick={() => onChange('')} variant="ghost" type="button">
          <X className="h-4 w-4" />
          Remove Logo
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          upload(e.dataTransfer.files?.[0])
        }}
        disabled={uploading}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center transition-colors ${
          dragging
            ? 'border-primary bg-primary/10'
            : 'hover:border-muted-foreground/50'
        } ${uploading ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}
      >
        <span className="text-sm text-muted-foreground">
          {uploading ? 'Uploading…' : 'Drag an image here, or click to browse'}
        </span>
        <span className="text-xs text-muted-foreground/70">
          PNG, JPEG, WebP, SVG or GIF · up to 4MB
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          upload(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}

export default FileUpload
