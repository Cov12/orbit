'use client'
import React from 'react'

import { EditorBtns } from '@/lib/constants'

type Props = Record<string, never>

const HeadingPlaceholder = (props: Props) => {
  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }
  return (
    <div
      draggable
      onDragStart={e => handleDragStart(e, 'heading')}
      className="flex h-14 w-14 cursor-grab items-center justify-center rounded-lg bg-muted transition-colors hover:bg-muted/80"
    >
      <div className="text-xs font-bold">H1</div>
    </div>
  )
}

export default HeadingPlaceholder
