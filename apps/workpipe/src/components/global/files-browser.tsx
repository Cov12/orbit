'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

import { FileText, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'

type DriveFile = {
  id: string
  name: string
  mimeType: string
  size: string | number
  createdAt: string
}

const isMedia = (m: string) =>
  m.startsWith('image/') || m.startsWith('video/') || m.startsWith('audio/')

function formatBytes(input: string | number): string {
  const n = Number(input)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export default function FilesBrowser({
  subAccountId,
  kind,
}: {
  subAccountId: string
  kind: 'media' | 'documents'
}) {
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/drive-proxy/files?subAccountId=${encodeURIComponent(subAccountId)}`
      )
      const data = await res.json().catch(() => ({}))
      const all: DriveFile[] = data.files ?? []
      setFiles(
        all.filter(f =>
          kind === 'media' ? isMedia(f.mimeType) : !isMedia(f.mimeType)
        )
      )
    } catch {
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [subAccountId, kind])

  useEffect(() => {
    load()
  }, [load])

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('subAccountId', subAccountId)
      const res = await fetch('/api/drive-proxy/upload', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) throw new Error('upload failed')
      toast({ title: 'Uploaded', description: file.name })
      await load()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Oops!',
        description: 'Could not upload the file.',
      })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onDelete = async (id: string) => {
    try {
      const res = await fetch(
        `/api/drive-proxy/files/${id}?subAccountId=${encodeURIComponent(subAccountId)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('delete failed')
      setFiles(f => f.filter(x => x.id !== id))
      toast({ title: 'Deleted' })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Oops!',
        description: 'Could not delete the file.',
      })
    }
  }

  const Icon = kind === 'media' ? ImageIcon : FileText
  const accept = kind === 'media' ? 'image/*,video/*,audio/*' : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Loading…'
            : `${files.length} file${files.length === 1 ? '' : 's'}`}
        </p>
        <Button
          className="gap-2"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Upload size={15} />
          )}
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onUpload}
        />
      </div>

      <div className="rounded-lg border bg-background">
        {files.length === 0 && !loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No {kind} yet. Upload one to get started.
          </div>
        ) : (
          <ul className="divide-y">
            {files.map(f => (
              <li key={f.id} className="flex items-center gap-3 p-3">
                <Icon size={18} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(f.size)} ·{' '}
                    {new Date(f.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(f.id)}
                  aria-label="Delete file"
                >
                  <Trash2 size={15} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
