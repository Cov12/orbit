'use client'
import React from 'react'

import { EditorBtns } from '@/lib/constants'

type Props = {}

const HeadingPlaceholder = (props: Props) => {
  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }
  return (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, 'heading')}
      className=" h-14 w-14 bg-muted rounded-lg flex items-center justify-center cursor-grab hover:bg-muted/80 transition-colors"
    >
      <div className="text-xs font-bold">H1</div>
    </div>
  )
}

export default HeadingPlaceholder