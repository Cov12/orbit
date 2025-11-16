'use client'

import React from 'react'

import clsx from 'clsx'
import { Trash } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { EditorBtns } from '@/lib/constants'
import { EditorElement, useEditor } from '@/providers/editor/editor-provider'


interface BaseFunnelComponentProps {
  element: EditorElement
  children: React.ReactNode
  className?: string
  onCustomClick?: (_e: React.MouseEvent) => void
}

/**
 * Base wrapper component for all funnel builder elements
 * Provides common functionality like:
 * - Drag and drop handling
 * - Selection state management
 * - Delete functionality
 * - Visual indicators for editing mode
 */
const BaseFunnelComponent: React.FC<BaseFunnelComponentProps> = ({
  element,
  children,
  className = '',
  onCustomClick,
}) => {
  const { dispatch, state } = useEditor()

  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }

  const handleOnClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    // Call custom click handler if provided
    if (onCustomClick) {
      onCustomClick(e)
    }

    // Update selected element in editor
    dispatch({
      type: 'CHANGE_CLICKED_ELEMENT',
      payload: {
        elementDetails: element,
      },
    })
  }

  const handleDeleteElement = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({
      type: 'DELETE_ELEMENT',
      payload: { elementDetails: element },
    })
  }

  const isSelected = state.editor.selectedElement.id === element.id
  const isLiveMode = state.editor.liveMode
  const styles = element.styles

  return (
    <div
      style={styles}
      draggable={!isLiveMode}
      onDragStart={(e) => handleDragStart(e, element.type)}
      onClick={handleOnClick}
      className={clsx(
        'relative transition-all',
        {
          '!border-blue-500 !border-solid': isSelected && !isLiveMode,
          'border-dashed border-[1px] border-slate-300': !isLiveMode,
          'hover:border-blue-300': !isLiveMode && !isSelected,
        },
        className
      )}
    >
      {/* Selection badge */}
      {isSelected && !isLiveMode && (
        <Badge className="absolute -top-[23px] -left-[1px] rounded-none rounded-t-lg z-10">
          {element.name}
        </Badge>
      )}

      {/* Component content */}
      {children}

      {/* Delete button */}
      {isSelected && !isLiveMode && (
        <div className="absolute bg-primary px-2.5 py-1 text-xs font-bold -top-[25px] -right-[1px] rounded-none rounded-t-lg !text-white z-10">
          <Trash
            className="cursor-pointer hover:text-red-300"
            size={16}
            onClick={handleDeleteElement}
          />
        </div>
      )}
    </div>
  )
}

export default BaseFunnelComponent