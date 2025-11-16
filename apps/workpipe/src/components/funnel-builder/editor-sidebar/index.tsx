'use client'

import React, { useState } from 'react'

import {
  Package,
  Settings,
  Layers,
  History,
  Undo,
  Redo,
  Eye,
  EyeOff,
  Smartphone,
  Tablet,
  Monitor,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEditor } from '@/providers/editor/editor-provider'

import ComponentPalette from './component-palette'
import PropertyEditor from './property-editor'


interface EditorSidebarProps {
  className?: string
}

const EditorSidebar: React.FC<EditorSidebarProps> = ({ className = '' }) => {
  const { state, dispatch } = useEditor()
  const [activeTab, setActiveTab] = useState('components')

  const selectedElement = state.editor.selectedElement
  const hasSelection = selectedElement && selectedElement.id !== ''

  const handleUndo = () => {
    dispatch({ type: 'UNDO' })
  }

  const handleRedo = () => {
    dispatch({ type: 'REDO' })
  }

  const togglePreview = () => {
    dispatch({ type: 'TOGGLE_PREVIEW_MODE' })
  }

  const setDevice = (device: 'Desktop' | 'Tablet' | 'Mobile') => {
    dispatch({
      type: 'CHANGE_DEVICE',
      payload: { device },
    })
  }

  // Auto-switch to properties tab when element is selected
  React.useEffect(() => {
    if (hasSelection && activeTab === 'components') {
      setActiveTab('properties')
    }
  }, [hasSelection, activeTab])

  return (
    <div className={`w-80 bg-background border-l flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={handleUndo}>
            <Undo className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleRedo}>
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={state.editor.device === 'Desktop' ? 'default' : 'ghost'}
            onClick={() => setDevice('Desktop')}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={state.editor.device === 'Tablet' ? 'default' : 'ghost'}
            onClick={() => setDevice('Tablet')}
          >
            <Tablet className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={state.editor.device === 'Mobile' ? 'default' : 'ghost'}
            onClick={() => setDevice('Mobile')}
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>

        <Button size="sm" variant="ghost" onClick={togglePreview}>
          {state.editor.previewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mode Indicator */}
      <div className="px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Badge variant={state.editor.previewMode ? 'default' : 'secondary'} className="text-xs">
              {state.editor.previewMode ? 'Preview' : 'Edit'} Mode
            </Badge>
            <Badge variant="outline" className="text-xs">
              {state.editor.device}
            </Badge>
          </div>
          {state.editor.liveMode && (
            <Badge variant="destructive" className="text-xs">
              LIVE
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 m-3 mb-0">
          <TabsTrigger value="components" className="text-xs">
            <Package className="h-3 w-3 mr-1" />
            Components
          </TabsTrigger>
          <TabsTrigger value="properties" className="text-xs">
            <Settings className="h-3 w-3 mr-1" />
            Properties
            {hasSelection && (
              <Badge variant="destructive" className="ml-1 h-4 w-4 rounded-full p-0 text-xs">
                1
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="layers" className="text-xs">
            <Layers className="h-3 w-3 mr-1" />
            Layers
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            <History className="h-3 w-3 mr-1" />
            History
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 flex flex-col">
          <TabsContent value="components" className="flex-1 m-0">
            <ComponentPalette />
          </TabsContent>

          <TabsContent value="properties" className="flex-1 m-0">
            <PropertyEditor />
          </TabsContent>

          <TabsContent value="layers" className="flex-1 m-0">
            <LayersPanel />
          </TabsContent>

          <TabsContent value="history" className="flex-1 m-0">
            <HistoryPanel />
          </TabsContent>
        </div>
      </Tabs>

      {/* Status Bar */}
      <div className="px-3 py-2 border-t bg-muted/30">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {state.editor.elements.length - 1} elements
          </span>
          <span>
            History: {state.history.currentIndex + 1}/{state.history.history.length}
          </span>
        </div>
      </div>
    </div>
  )
}

// Placeholder components for additional panels
const LayersPanel: React.FC = () => (
  <div className="h-full flex items-center justify-center p-4">
    <div className="text-center text-muted-foreground">
      <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">Layers panel</p>
      <p className="text-xs">Coming soon</p>
    </div>
  </div>
)

const HistoryPanel: React.FC = () => {
  const { state, dispatch } = useEditor()

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">History</h3>
      </div>
      <div className="flex-1 p-4">
        <div className="space-y-2">
          {state.history.history.map((_, index) => (
            <div
              key={index}
              className={`p-2 text-xs rounded cursor-pointer ${
                index === state.history.currentIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
              onClick={() => {
                const diff = index - state.history.currentIndex
                for (let i = 0; i < Math.abs(diff); i++) {
                  dispatch({ type: diff > 0 ? 'REDO' : 'UNDO' })
                }
              }}
            >
              State {index + 1}
              {index === state.history.currentIndex && ' (Current)'}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EditorSidebar