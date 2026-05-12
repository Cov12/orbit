'use client'
import { useEffect, useCallback } from 'react'

import clsx from 'clsx'
import { EyeOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getFunnelPageDetails } from '@/lib/queries'
import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

import Recursive from './funnel-editor-components/recursive'

type Props = { funnelPageId: string; liveMode?: boolean }

// Helper function to generate UUID
const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Deep clone an element with new IDs
const cloneElementWithNewIds = (element: EditorElement): EditorElement => {
  const clonedElement: EditorElement = {
    ...element,
    id: generateId(),
    name: `${element.name} (copy)`,
  }

  if (Array.isArray(element.content)) {
    clonedElement.content = element.content.map((child) =>
      cloneElementWithNewIds(child)
    )
  } else {
    clonedElement.content = { ...element.content }
  }

  return clonedElement
}

const FunnelEditor = ({ funnelPageId, liveMode }: Props) => {
  const { dispatch, state } = useEditor()

  // Find parent container ID for an element
  const findParentId = useCallback(
    (
      elements: EditorElement[],
      targetId: string,
      parentId: string = '__body'
    ): string => {
      for (const el of elements) {
        if (el.id === targetId) return parentId
        if (Array.isArray(el.content)) {
          const found = findParentId(el.content, targetId, el.id)
          if (
            found !== '__body' ||
            el.content.some((c: EditorElement) => c.id === targetId)
          ) {
            return found !== '__body' ? found : el.id
          }
        }
      }
      return parentId
    },
    []
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.contentEditable === 'true'
      ) {
        return
      }

      // Don't trigger in live/preview mode
      if (state.editor.liveMode || state.editor.previewMode) {
        return
      }

      const selectedElement = state.editor.selectedElement

      // Delete: Delete/Backspace
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedElement.id &&
        selectedElement.type !== '__body'
      ) {
        e.preventDefault()
        dispatch({
          type: 'DELETE_ELEMENT',
          payload: { elementDetails: selectedElement },
        })
      }

      // Duplicate: Ctrl+D / Cmd+D
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === 'd' &&
        selectedElement.id &&
        selectedElement.type !== '__body'
      ) {
        e.preventDefault()
        const containerId = findParentId(
          state.editor.elements,
          selectedElement.id
        )
        dispatch({
          type: 'DUPLICATE_ELEMENT',
          payload: {
            elementDetails: selectedElement,
            containerId,
          },
        })
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        dispatch({ type: 'UNDO' })
      }

      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault()
        dispatch({ type: 'REDO' })
      }

      // Escape: Deselect element
      if (e.key === 'Escape') {
        e.preventDefault()
        dispatch({
          type: 'CHANGE_CLICKED_ELEMENT',
          payload: {},
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    state.editor.selectedElement,
    state.editor.elements,
    state.editor.liveMode,
    state.editor.previewMode,
    dispatch,
    findParentId,
  ])

  useEffect(() => {
    if (liveMode) {
      dispatch({
        type: 'TOGGLE_LIVE_MODE',
        payload: { value: true },
      })
    }
  }, [liveMode])

  //CHALLENGE: make this more performant
  useEffect(() => {
    const fetchData = async () => {
      const response = await getFunnelPageDetails(funnelPageId)
      if (!response) return

      dispatch({
        type: 'LOAD_DATA',
        payload: {
          elements: response.content ? JSON.parse(response?.content) : '',
          withLive: !!liveMode,
        },
      })
    }
    fetchData()
  }, [funnelPageId])

  const handleClick = () => {
    dispatch({
      type: 'CHANGE_CLICKED_ELEMENT',
      payload: {},
    })
  }

  const handleUnpreview = () => {
    dispatch({ type: 'TOGGLE_PREVIEW_MODE' })
    dispatch({ type: 'TOGGLE_LIVE_MODE' })
  }
  return (
    <div
      className={clsx(
        'use-automation-zoom-in h-full overflow-scroll mr-[385px] bg-background transition-all rounded-md',
        {
          '!p-0 !mr-0':
            state.editor.previewMode === true || state.editor.liveMode === true,
          '!w-[850px]': state.editor.device === 'Tablet',
          '!w-[420px]': state.editor.device === 'Mobile',
          'w-full': state.editor.device === 'Desktop',
        }
      )}
      onClick={handleClick}
    >
      {state.editor.previewMode && state.editor.liveMode && (
        <Button
          variant={'ghost'}
          size={'icon'}
          className="w-6 h-6 bg-slate-600 p-[2px] fixed top-0 left-0 z-[100]"
          onClick={handleUnpreview}
        >
          <EyeOff />
        </Button>
      )}
      {Array.isArray(state.editor.elements) &&
        state.editor.elements.map((childElement) => (
          <Recursive
            key={childElement.id}
            element={childElement}
          />
        ))}
    </div>
  )
}

export default FunnelEditor
