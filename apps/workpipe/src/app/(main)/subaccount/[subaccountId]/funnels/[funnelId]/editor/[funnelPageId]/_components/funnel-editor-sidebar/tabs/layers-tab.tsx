'use client'

import React from 'react'

import clsx from 'clsx'
import {
  ChevronDown,
  ChevronRight,
  Box,
  Type,
  Image,
  Link,
  Video,
  LayoutGrid,
  Columns2,
  Columns3,
  MousePointer,
  FormInput,
  CreditCard,
  Heading,
  Sparkles,
  FileText,
  Star,
  Minus,
  Space,
  Code,
  QrCode,
  PanelTop,
  ListCollapse,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

type Props = Record<string, never>

// Icon mapping for element types
const elementIcons: Record<string, React.ElementType> = {
  __body: LayoutGrid,
  container: Box,
  '2Col': Columns2,
  '3Col': Columns3,
  text: Type,
  link: Link,
  video: Video,
  image: Image,
  button: MousePointer,
  contactForm: FormInput,
  paymentForm: CreditCard,
  heading: Heading,
  'animated-text': Sparkles,
  'rich-text': FileText,
  icon: Star,
  divider: Minus,
  spacer: Space,
  'code-block': Code,
  'qr-code': QrCode,
  tabs: PanelTop,
  accordion: ListCollapse,
}

interface LayerItemProps {
  element: EditorElement
  depth: number
}

const LayerItem = ({ element, depth }: LayerItemProps) => {
  const { state, dispatch } = useEditor()
  const [isExpanded, setIsExpanded] = React.useState(true)

  const hasChildren = Array.isArray(element.content) && element.content.length > 0
  const isSelected = state.editor.selectedElement.id === element.id
  const isBody = element.type === '__body'

  const IconComponent = elementIcons[element.type] || Box

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({
      type: 'CHANGE_CLICKED_ELEMENT',
      payload: {
        elementDetails: element,
      },
    })
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isBody) return
    dispatch({
      type: 'DELETE_ELEMENT',
      payload: {
        elementDetails: element,
      },
    })
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="select-none">
      <div
        className={clsx(
          'group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50',
          {
            'bg-primary/10 text-primary': isSelected,
            'text-muted-foreground': !isSelected,
          }
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleSelect}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-muted"
          >
            {isExpanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Icon */}
        <IconComponent size={14} className="shrink-0" />

        {/* Name */}
        <span className="flex-1 truncate text-xs">
          {element.name || element.type}
        </span>

        {/* Actions (visible on hover) */}
        {!isBody && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              title="Delete"
            >
              <Trash2 size={12} />
            </Button>
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {(element.content as EditorElement[]).map((child) => (
            <LayerItem key={child.id} element={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

const LayersTab = (props: Props) => {
  const { state } = useEditor()

  // Find the body element
  const bodyElement = state.editor.elements.find((el) => el.type === '__body')

  if (!bodyElement) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No elements yet
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(100vh-250px)]">
      <div className="p-2">
        <LayerItem element={bodyElement} depth={0} />
      </div>
    </ScrollArea>
  )
}

export default LayersTab
