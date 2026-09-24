'use client'
import React from 'react'

import clsx from 'clsx'
import { Copy, Trash } from 'lucide-react'
import { v4 } from 'uuid'

import { Badge } from '@/components/ui/badge'
import { EditorBtns, defaultStyles } from '@/lib/constants'
import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

import Recursive from './recursive'

type Props = { element: EditorElement }

const Container = ({ element }: Props) => {
  const { id, content, name, styles, type } = element
  const { dispatch, state } = useEditor()

  const handleOnDrop = (e: React.DragEvent, type: string) => {
    e.stopPropagation()
    const componentType = e.dataTransfer.getData('componentType') as EditorBtns

    switch (componentType) {
      case 'text':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: { innerText: 'Text Element' },
              id: v4(),
              name: 'Text',
              styles: {
                color: 'black',
                ...defaultStyles,
              },
              type: 'text',
            },
          },
        })
        break
      case 'link':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                innerText: 'Link Element',
                href: '#',
              },
              id: v4(),
              name: 'Link',
              styles: {
                color: 'black',
                ...defaultStyles,
              },
              type: 'link',
            },
          },
        })
        break
      case 'video':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                src: 'https://www.youtube.com/embed/A3l6YYkXzzg?si=zbcCeWcpq7Cwf8W1',
              },
              id: v4(),
              name: 'Video',
              styles: {},
              type: 'video',
            },
          },
        })
        break
      case 'container':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: [],
              id: v4(),
              name: 'Container',
              styles: { ...defaultStyles },
              type: 'container',
            },
          },
        })
        break
      case 'contactForm':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              // Seeded as an object (not []) so the settings panel has somewhere
              // to write: these are the copy the live form used to hardcode,
              // plus every optional field shown by default.
              content: {
                title: 'Want a free quote? We can help you',
                subTitle: 'Contact Us',
                submitText: 'Get a free quote!',
                fields: ['phone', 'companyName', 'message'],
              },
              id: v4(),
              name: 'Contact Form',
              styles: {},
              type: 'contactForm',
            },
          },
        })
        break
      case 'paymentForm':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: [],
              id: v4(),
              name: 'Contact Form',
              styles: {},
              type: 'paymentForm',
            },
          },
        })
        break
      case '2Col':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: [
                {
                  content: [],
                  id: v4(),
                  name: 'Container',
                  styles: { ...defaultStyles, width: '100%' },
                  type: 'container',
                },
                {
                  content: [],
                  id: v4(),
                  name: 'Container',
                  styles: { ...defaultStyles, width: '100%' },
                  type: 'container',
                },
              ],
              id: v4(),
              name: 'Two Columns',
              styles: { ...defaultStyles, display: 'flex' },
              type: '2Col',
            },
          },
        })
        break
      case '3Col':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: [
                {
                  content: [],
                  id: v4(),
                  name: 'Container',
                  styles: { ...defaultStyles, width: '100%' },
                  type: 'container',
                },
                {
                  content: [],
                  id: v4(),
                  name: 'Container',
                  styles: { ...defaultStyles, width: '100%' },
                  type: 'container',
                },
                {
                  content: [],
                  id: v4(),
                  name: 'Container',
                  styles: { ...defaultStyles, width: '100%' },
                  type: 'container',
                },
              ],
              id: v4(),
              name: 'Three Columns',
              styles: { ...defaultStyles, display: 'flex' },
              type: '3Col',
            },
          },
        })
        break
      case 'button':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                text: 'Click Me',
                href: '#',
                target: '_self',
                variant: 'primary',
                size: 'md',
                fullWidth: false,
                borderRadius: '8px',
                backgroundColor: '#6366f1',
                textColor: '#ffffff',
              } as any,
              id: v4(),
              name: 'Button',
              styles: { ...defaultStyles },
              type: 'button',
            },
          },
        })
        break
      case 'image':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                src: '',
                alt: 'Image',
                href: '',
                target: '_self',
                objectFit: 'cover',
                borderRadius: '0px',
                width: '100%',
                height: 'auto',
              } as any,
              id: v4(),
              name: 'Image',
              styles: { ...defaultStyles },
              type: 'image',
            },
          },
        })
        break
      case 'heading':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                text: 'Heading',
                level: 'h2',
                alignment: 'left',
              } as any,
              id: v4(),
              name: 'Heading',
              styles: { ...defaultStyles },
              type: 'heading',
            },
          },
        })
        break
      case 'animated-text':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                text: 'Animated Text',
                animation: 'fade',
                duration: 1000,
              } as any,
              id: v4(),
              name: 'Animated Text',
              styles: { ...defaultStyles },
              type: 'animated-text',
            },
          },
        })
        break
      case 'rich-text':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                content: '<p>Rich text content here...</p>',
                placeholder: 'Start typing...',
                editable: true,
              } as any,
              id: v4(),
              name: 'Rich Text',
              styles: { ...defaultStyles },
              type: 'rich-text',
            },
          },
        })
        break
      case 'icon':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                icon: 'star',
                size: 24,
                color: '#000000',
              } as any,
              id: v4(),
              name: 'Icon',
              styles: { ...defaultStyles },
              type: 'icon',
            },
          },
        })
        break
      case 'divider':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                style: 'solid',
                thickness: 1,
                color: '#e5e5e5',
                spacing: 20,
              } as any,
              id: v4(),
              name: 'Divider',
              styles: { ...defaultStyles },
              type: 'divider',
            },
          },
        })
        break
      case 'spacer':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                height: 40,
                responsive: true,
              } as any,
              id: v4(),
              name: 'Spacer',
              styles: { ...defaultStyles },
              type: 'spacer',
            },
          },
        })
        break
      case 'code-block':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                code: 'console.log("Hello World");',
                language: 'javascript',
                showLineNumbers: true,
                theme: 'dark',
              } as any,
              id: v4(),
              name: 'Code Block',
              styles: { ...defaultStyles },
              type: 'code-block',
            },
          },
        })
        break
      case 'qr-code':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                value: 'https://example.com',
                size: 200,
                backgroundColor: '#ffffff',
                foregroundColor: '#000000',
              } as any,
              id: v4(),
              name: 'QR Code',
              styles: { ...defaultStyles },
              type: 'qr-code',
            },
          },
        })
        break
      case 'tabs':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                tabs: [
                  { id: v4(), label: 'Tab 1', content: 'Content for Tab 1' },
                  { id: v4(), label: 'Tab 2', content: 'Content for Tab 2' },
                  { id: v4(), label: 'Tab 3', content: 'Content for Tab 3' },
                ],
                variant: 'default',
                tabPosition: 'top',
                tabAlignment: 'start',
              } as any,
              id: v4(),
              name: 'Tabs',
              styles: { ...defaultStyles },
              type: 'tabs',
            },
          },
        })
        break
      case 'accordion':
        dispatch({
          type: 'ADD_ELEMENT',
          payload: {
            containerId: id,
            elementDetails: {
              content: {
                items: [
                  {
                    id: v4(),
                    title: 'What is your return policy?',
                    content:
                      'We offer a 30-day return policy for all unused items.',
                  },
                  {
                    id: v4(),
                    title: 'How long does shipping take?',
                    content: 'Standard shipping takes 5-7 business days.',
                  },
                  {
                    id: v4(),
                    title: 'Do you offer international shipping?',
                    content: 'Yes, we ship to over 50 countries worldwide.',
                  },
                ],
                allowMultiple: false,
                variant: 'default',
                iconPosition: 'right',
              } as any,
              id: v4(),
              name: 'Accordion',
              styles: { ...defaultStyles },
              type: 'accordion',
            },
          },
        })
        break
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDragStart = (e: React.DragEvent, type: string) => {
    if (type === '__body') return
    e.dataTransfer.setData('componentType', type)
  }

  const handleOnClickBody = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({
      type: 'CHANGE_CLICKED_ELEMENT',
      payload: {
        elementDetails: element,
      },
    })
  }

  const handleDeleteElement = () => {
    dispatch({
      type: 'DELETE_ELEMENT',
      payload: {
        elementDetails: element,
      },
    })
  }

  const handleDuplicateElement = () => {
    // Find the parent container ID
    const findParentId = (
      elements: any[],
      targetId: string,
      parentId: string = '__body'
    ): string => {
      for (const el of elements) {
        if (el.id === targetId) return parentId
        if (Array.isArray(el.content)) {
          const found = findParentId(el.content, targetId, el.id)
          if (
            found !== '__body' ||
            el.content.some((c: any) => c.id === targetId)
          ) {
            return found !== '__body' ? found : el.id
          }
        }
      }
      return parentId
    }

    const containerId = findParentId(state.editor.elements, element.id)

    dispatch({
      type: 'DUPLICATE_ELEMENT',
      payload: {
        elementDetails: element,
        containerId,
      },
    })
  }

  return (
    <div
      style={styles}
      className={clsx('group relative p-4 transition-all', {
        'w-full max-w-full':
          type === 'container' || type === '2Col' || type === '3Col',
        'h-fit': type === 'container',
        'h-full': type === '__body',
        'overflow-scroll': type === '__body',
        'flex flex-col md:!flex-row': type === '2Col' || type === '3Col',
        '!border-blue-500':
          state.editor.selectedElement.id === id &&
          !state.editor.liveMode &&
          state.editor.selectedElement.type !== '__body',
        '!border-4 !border-yellow-400':
          state.editor.selectedElement.id === id &&
          !state.editor.liveMode &&
          state.editor.selectedElement.type === '__body',
        '!border-solid':
          state.editor.selectedElement.id === id && !state.editor.liveMode,
        'border-[1px] border-dashed border-slate-300': !state.editor.liveMode,
      })}
      onDrop={e => handleOnDrop(e, id)}
      onDragOver={handleDragOver}
      draggable={type !== '__body'}
      onClick={handleOnClickBody}
      onDragStart={e => handleDragStart(e, 'container')}
    >
      <Badge
        className={clsx(
          'absolute -left-[1px] -top-[23px] hidden rounded-none rounded-t-lg',
          {
            block:
              state.editor.selectedElement.id === element.id &&
              !state.editor.liveMode,
          }
        )}
      >
        {element.name}
      </Badge>

      {Array.isArray(content) &&
        content.map(childElement => (
          <Recursive key={childElement.id} element={childElement} />
        ))}

      {state.editor.selectedElement.id === element.id &&
        !state.editor.liveMode &&
        state.editor.selectedElement.type !== '__body' && (
          <div className="absolute -right-[1px] -top-[25px] flex gap-1 rounded-none rounded-t-lg bg-primary px-2 py-1 text-xs font-bold">
            <button
              type="button"
              className="cursor-pointer hover:text-blue-300"
              onClick={handleDuplicateElement}
              title="Duplicate"
              aria-label="Duplicate"
            >
              <Copy size={16} />
            </button>
            <button
              type="button"
              className="cursor-pointer hover:text-red-300"
              onClick={handleDeleteElement}
              title="Delete"
              aria-label="Delete"
            >
              <Trash size={16} />
            </button>
          </div>
        )}
    </div>
  )
}

export default Container
