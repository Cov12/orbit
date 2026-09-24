import React from 'react'

import { Youtube } from 'lucide-react'

import { EditorBtns } from '@/lib/constants'

type Props = Record<string, never>

const VideoPlaceholder = (props: Props) => {
  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }
  return (
    <div
      draggable
      onDragStart={e => handleDragStart(e, 'video')}
      className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted"
    >
      <Youtube size={40} className="text-muted-foreground" />
    </div>
  )
}

export default VideoPlaceholder
