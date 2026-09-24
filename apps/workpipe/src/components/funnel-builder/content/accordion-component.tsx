'use client'

import React, { useState } from 'react'

import { ChevronDown, Plus, Trash2 } from 'lucide-react'

import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

interface AccordionItem {
  id: string
  title: string
  content: string
}

interface AccordionContent {
  items: AccordionItem[]
  allowMultiple: boolean
  defaultOpen: string[]
  variant: 'default' | 'bordered' | 'separated'
  iconPosition: 'left' | 'right'
  headerBackgroundColor: string
  headerTextColor: string
  contentBackgroundColor: string
  contentTextColor: string
  borderColor: string
  borderRadius: string
}

interface AccordionComponentProps {
  element: EditorElement
}

const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

const AccordionComponent: React.FC<AccordionComponentProps> = ({ element }) => {
  const { dispatch, state } = useEditor()
  const content = element.content as AccordionContent

  const items = content?.items || [
    { id: generateItemId(), title: 'What is your return policy?', content: 'We offer a 30-day return policy for all unused items in original packaging.' },
    { id: generateItemId(), title: 'How long does shipping take?', content: 'Standard shipping takes 5-7 business days. Express shipping is available for 2-3 day delivery.' },
    { id: generateItemId(), title: 'Do you offer international shipping?', content: 'Yes, we ship to over 50 countries worldwide. Shipping rates vary by location.' },
  ]

  const [openItems, setOpenItems] = useState<string[]>(content?.defaultOpen || [items[0]?.id])
  const allowMultiple = content?.allowMultiple ?? false
  const variant = content?.variant || 'default'
  const iconPosition = content?.iconPosition || 'right'

  const updateContent = (newContent: Partial<AccordionContent>) => {
    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        elementDetails: {
          ...element,
          content: {
            ...content,
            ...newContent,
          } as any,
        },
      },
    })
  }

  const toggleItem = (itemId: string) => {
    if (allowMultiple) {
      setOpenItems(prev =>
        prev.includes(itemId)
          ? prev.filter(id => id !== itemId)
          : [...prev, itemId]
      )
    } else {
      setOpenItems(prev =>
        prev.includes(itemId) ? [] : [itemId]
      )
    }
  }

  const handleTitleChange = (itemId: string, newTitle: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, title: newTitle } : item
    )
    updateContent({ items: updatedItems })
  }

  const handleContentChange = (itemId: string, newContent: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, content: newContent } : item
    )
    updateContent({ items: updatedItems })
  }

  const addItem = () => {
    const newItem: AccordionItem = {
      id: generateItemId(),
      title: `Question ${items.length + 1}`,
      content: `Answer for question ${items.length + 1}`,
    }
    updateContent({ items: [...items, newItem] })
  }

  const removeItem = (itemId: string) => {
    if (items.length <= 1) return
    const updatedItems = items.filter(item => item.id !== itemId)
    updateContent({ items: updatedItems })
    setOpenItems(prev => prev.filter(id => id !== itemId))
  }

  const getContainerStyles = (): React.CSSProperties => {
    const borderRadius = content?.borderRadius || '8px'
    const borderColor = content?.borderColor || '#e2e8f0'

    switch (variant) {
      case 'bordered':
        return {
          border: `1px solid ${borderColor}`,
          borderRadius,
          overflow: 'hidden',
        }
      case 'separated':
        return {
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }
      default:
        return {
          borderRadius,
          overflow: 'hidden',
        }
    }
  }

  const getItemStyles = (isFirst: boolean, isLast: boolean): React.CSSProperties => {
    const borderColor = content?.borderColor || '#e2e8f0'
    const borderRadius = content?.borderRadius || '8px'

    switch (variant) {
      case 'bordered':
        return {
          borderBottom: isLast ? 'none' : `1px solid ${borderColor}`,
        }
      case 'separated':
        return {
          border: `1px solid ${borderColor}`,
          borderRadius,
          overflow: 'hidden',
        }
      default:
        return {
          borderBottom: isLast ? 'none' : `1px solid ${borderColor}`,
        }
    }
  }

  const getHeaderStyles = (isOpen: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    cursor: 'pointer',
    backgroundColor: content?.headerBackgroundColor || '#f8fafc',
    color: content?.headerTextColor || '#1e293b',
    fontWeight: 500,
    fontSize: '15px',
    transition: 'background-color 0.2s ease',
    flexDirection: iconPosition === 'left' ? 'row-reverse' : 'row',
  })

  const getContentStyles = (isOpen: boolean): React.CSSProperties => ({
    maxHeight: isOpen ? '500px' : '0',
    overflow: 'hidden',
    transition: 'max-height 0.3s ease-in-out',
    backgroundColor: content?.contentBackgroundColor || '#ffffff',
    color: content?.contentTextColor || '#64748b',
  })

  const isLiveMode = state.editor.liveMode

  return (
    <BaseFunnelComponent element={element} className="w-full">
      <div style={getContainerStyles()}>
        {items.map((item, index) => {
          const isOpen = openItems.includes(item.id)
          const isFirst = index === 0
          const isLast = index === items.length - 1

          return (
            <div key={item.id} style={getItemStyles(isFirst, isLast)} className="group relative">
              <div
                style={getHeaderStyles(isOpen)}
                onClick={() => toggleItem(item.id)}
                className="hover:bg-slate-100"
              >
                {isLiveMode ? (
                  <span>{item.title}</span>
                ) : (
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => handleTitleChange(item.id, e.currentTarget.innerText)}
                    className="outline-none flex-1"
                  >
                    {item.title}
                  </span>
                )}
                <ChevronDown
                  size={20}
                  className="transition-transform duration-200 flex-shrink-0"
                  style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    marginLeft: iconPosition === 'right' ? '12px' : '0',
                    marginRight: iconPosition === 'left' ? '12px' : '0',
                  }}
                />
              </div>

              <div style={getContentStyles(isOpen)}>
                <div className="p-5 leading-relaxed">
                  {isLiveMode ? (
                    <p>{item.content}</p>
                  ) : (
                    <p
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleContentChange(item.id, e.currentTarget.innerText)}
                      className="outline-none min-h-[40px]"
                    >
                      {item.content}
                    </p>
                  )}
                </div>
              </div>

              {!isLiveMode && items.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeItem(item.id)
                  }}
                  className="absolute top-3 right-12 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                  title="Remove item"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        })}

        {!isLiveMode && (
          <button
            onClick={addItem}
            className="w-full py-3 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 border-t border-slate-200"
            title="Add item"
          >
            <Plus size={18} />
            <span className="text-sm">Add Item</span>
          </button>
        )}
      </div>
    </BaseFunnelComponent>
  )
}

export default AccordionComponent
