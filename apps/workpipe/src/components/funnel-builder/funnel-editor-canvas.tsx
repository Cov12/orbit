'use client'

import React, { useCallback } from 'react'

import clsx from 'clsx'

import { EditorBtns } from '@/lib/constants'
import { FunnelComponentManager } from '@/lib/funnel-component-manager'
import { useEditor, EditorElement } from '@/providers/editor/editor-provider'

import { ComponentRegistry } from './component-registry'


interface FunnelEditorCanvasProps {
  className?: string
}

const FunnelEditorCanvas: React.FC<FunnelEditorCanvasProps> = ({ className = '' }) => {
  const { state, dispatch } = useEditor()

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const componentType = e.dataTransfer.getData('componentType') as EditorBtns

      if (!componentType) return

      const componentDef = FunnelComponentManager.getComponentDefinitionByType(componentType)
      if (!componentDef) return

      const newElement = FunnelComponentManager.createElement(componentDef, '__body')

      dispatch({
        type: 'ADD_ELEMENT',
        payload: {
          containerId: '__body',
          elementDetails: newElement,
        },
      })
    },
    [dispatch]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        dispatch({
          type: 'CHANGE_CLICKED_ELEMENT',
          payload: {
            elementDetails: {
              id: '',
              content: [],
              name: '',
              styles: {},
              type: null,
            },
          },
        })
      }
    },
    [dispatch]
  )

  const renderElement = (element: EditorElement): React.ReactNode => {
    return <ComponentRegistry key={element.id} element={element} />
  }

  const canvasStyles = {
    width: '100%',
    minHeight: '100vh',
    background: state.editor.previewMode ? '#ffffff' : '#f8f9fa',
  }

  // Device-specific canvas sizing
  const getCanvasClassName = () => {
    const baseClasses = 'mx-auto transition-all duration-300'

    switch (state.editor.device) {
      case 'Mobile':
        return `${baseClasses} max-w-sm`
      case 'Tablet':
        return `${baseClasses} max-w-2xl`
      case 'Desktop':
      default:
        return `${baseClasses} max-w-full`
    }
  }

  return (
    <div className={`flex-1 overflow-auto ${className}`}>
      <div className="p-4">
        <div className={getCanvasClassName()}>
          <div
            className={clsx(
              'relative bg-white shadow-lg rounded-lg overflow-hidden',
              {
                'border-2 border-dashed border-gray-300': !state.editor.previewMode,
                'shadow-xl': state.editor.previewMode,
              }
            )}
            style={canvasStyles}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={handleCanvasClick}
          >
            {/* Canvas Header */}
            {!state.editor.previewMode && (
              <div className="absolute top-0 left-0 right-0 bg-gray-50 border-b px-4 py-2 z-10">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Canvas ({state.editor.device})
                  </div>
                  <div className="text-xs text-gray-500">
                    Drop components here or use the + button in sidebar
                  </div>
                </div>
              </div>
            )}

            {/* Canvas Content */}
            <div
              className={clsx('relative', {
                'pt-12': !state.editor.previewMode, // Space for header
              })}
            >
              {state.editor.elements.length === 1 && !state.editor.previewMode ? (
                // Empty state
                <div className="flex items-center justify-center min-h-[60vh] text-center p-8">
                  <div>
                    <div className="text-6xl mb-4 opacity-20">🎨</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      Start Building Your Funnel
                    </h3>
                    <p className="text-gray-500 mb-4 max-w-md">
                      Drag components from the sidebar or click the + button to add elements to your funnel page.
                    </p>
                    <div className="text-sm text-gray-400">
                      Choose from {FunnelComponentManager.getAllComponents().length}+ components
                      across {FunnelComponentManager.getCategories().length} categories
                    </div>
                  </div>
                </div>
              ) : (
                // Render elements
                <div className="min-h-[60vh]">
                  {state.editor.elements
                    .filter((element) => element.id !== '__body')
                    .map(renderElement)}
                </div>
              )}
            </div>

            {/* Drop zone indicator */}
            {!state.editor.previewMode && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-lg p-4 text-center text-blue-600 text-sm opacity-0 hover:opacity-100 transition-opacity">
                    Drop zone - Release component here
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Device Preview Info */}
        {!state.editor.previewMode && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              <span>Previewing:</span>
              <span className="font-medium">{state.editor.device}</span>
              <span>•</span>
              <span>{state.editor.elements.length - 1} elements</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FunnelEditorCanvas