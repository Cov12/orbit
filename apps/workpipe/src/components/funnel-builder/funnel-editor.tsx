'use client'

import React from 'react'

import {
  Save,
  Eye,
  Share,
  Settings,
  ArrowLeft,
  Loader2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useEditor } from '@/providers/editor/editor-provider'

import EditorSidebar from './editor-sidebar'
import FunnelEditorCanvas from './funnel-editor-canvas'


interface FunnelEditorProps {
  funnelPageId: string
  funnelId: string
  subaccountId: string
  pageDetails?: {
    name: string
    pathName: string
    order: number
  }
  onSave?: () => Promise<void>
  onPreview?: () => void
  onBack?: () => void
  className?: string
}

const FunnelEditor: React.FC<FunnelEditorProps> = ({
  funnelPageId,
  funnelId,
  _subaccountId,
  pageDetails,
  onSave,
  onPreview,
  onBack,
  className = '',
}) => {
  const { state, dispatch } = useEditor()
  const [isSaving, setIsSaving] = React.useState(false)

  const handleSave = async () => {
    if (!onSave) return

    setIsSaving(true)
    try {
      await onSave()
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const togglePreviewMode = () => {
    dispatch({ type: 'TOGGLE_PREVIEW_MODE' })
  }

  const handlePreview = () => {
    if (onPreview) {
      onPreview()
    } else {
      // Default preview behavior
      togglePreviewMode()
    }
  }

  return (
    <div className={`h-screen flex flex-col bg-background ${className}`}>
      {/* Header */}
      <header className="border-b bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left Section */}
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}

            <Separator orientation="vertical" className="h-6" />

            <div>
              <h1 className="font-semibold text-sm">
                {pageDetails?.name || 'Funnel Page Editor'}
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>/{pageDetails?.pathName || 'page'}</span>
                {pageDetails?.order !== undefined && (
                  <>
                    <span>•</span>
                    <span>Step {pageDetails.order + 1}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Center Section */}
          <div className="flex items-center gap-2">
            <Badge
              variant={state.editor.previewMode ? 'default' : 'secondary'}
              className="text-xs"
            >
              {state.editor.previewMode ? 'Preview' : 'Edit'} Mode
            </Badge>

            <Badge variant="outline" className="text-xs">
              {state.editor.device}
            </Badge>

            {state.editor.liveMode && (
              <Badge variant="destructive" className="text-xs">
                LIVE
              </Badge>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePreview}>
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>

            <Button variant="outline" size="sm">
              <Share className="h-4 w-4 mr-1" />
              Share
            </Button>

            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>

            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <FunnelEditorCanvas className="flex-1" />

        {/* Sidebar */}
        <EditorSidebar />
      </div>

      {/* Footer */}
      <footer className="border-t bg-muted/30 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              {state.editor.elements.length - 1} components
            </span>
            <span>
              {state.history.history.length} states in history
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span>
              Funnel ID: {funnelId}
            </span>
            <span>
              Page ID: {funnelPageId}
            </span>
            <span>
              Using shadcn MCP components
            </span>
          </div>
        </div>
      </footer>

      {/* Keyboard Shortcuts Overlay */}
      {!state.editor.previewMode && (
        <div className="absolute bottom-4 left-4 bg-black/80 text-white text-xs px-3 py-2 rounded-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <div className="space-y-1">
            <div><kbd>Ctrl+Z</kbd> Undo</div>
            <div><kbd>Ctrl+Y</kbd> Redo</div>
            <div><kbd>Ctrl+S</kbd> Save</div>
            <div><kbd>Ctrl+P</kbd> Preview</div>
            <div><kbd>Delete</kbd> Delete selected</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FunnelEditor