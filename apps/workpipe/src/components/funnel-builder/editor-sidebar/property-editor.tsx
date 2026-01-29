'use client'

import React, { useState, useEffect } from 'react'

import { Settings, Palette, Layout, Type, Copy, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { FunnelComponentManager } from '@/lib/funnel-component-manager'
import { useEditor } from '@/providers/editor/editor-provider'

interface PropertyEditorProps {
  className?: string
}

const PropertyEditor: React.FC<PropertyEditorProps> = ({ className = '' }) => {
  const { state, dispatch } = useEditor()
  const selectedElement = state.editor.selectedElement
  const [localProps, setLocalProps] = useState<Record<string, any>>({})

  const componentDef = selectedElement?.type
    ? FunnelComponentManager.getComponentDefinitionByType(selectedElement.type)
    : null

  // Update local props when selection changes
  useEffect(() => {
    if (
      selectedElement &&
      typeof selectedElement.content === 'object' &&
      !Array.isArray(selectedElement.content)
    ) {
      setLocalProps(selectedElement.content)
    } else {
      setLocalProps({})
    }
  }, [selectedElement])

  const updateProperty = (key: string, value: any) => {
    const newProps = { ...localProps, [key]: value }
    setLocalProps(newProps)

    if (selectedElement) {
      dispatch({
        type: 'UPDATE_ELEMENT',
        payload: {
          elementDetails: {
            ...selectedElement,
            content: newProps,
          },
        },
      })
    }
  }

  const updateStyle = (key: string, value: any) => {
    if (selectedElement) {
      dispatch({
        type: 'UPDATE_ELEMENT',
        payload: {
          elementDetails: {
            ...selectedElement,
            styles: {
              ...selectedElement.styles,
              [key]: value,
            },
          },
        },
      })
    }
  }

  const handleCloneElement = () => {
    if (selectedElement) {
      const clonedElement = FunnelComponentManager.cloneElement(selectedElement)
      dispatch({
        type: 'ADD_ELEMENT',
        payload: {
          containerId: '__body',
          elementDetails: clonedElement,
        },
      })
    }
  }

  const handleDeleteElement = () => {
    if (selectedElement) {
      dispatch({
        type: 'DELETE_ELEMENT',
        payload: { elementDetails: selectedElement },
      })
    }
  }

  if (!selectedElement || selectedElement.id === '') {
    return (
      <div className={`flex h-full flex-col ${className}`}>
        <div className="border-b p-4">
          <h3 className="text-sm font-semibold">Properties</h3>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-center text-muted-foreground">
            <Settings className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">Select an element to edit its properties</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Header */}
      <div className="border-b p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Properties</h3>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handleCloneElement}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDeleteElement}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {selectedElement.type}
          </Badge>
          <span className="truncate text-sm font-medium">
            {selectedElement.name}
          </span>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <Tabs defaultValue="content" className="w-full">
          <TabsList className="mx-4 mt-4 grid w-full grid-cols-3">
            <TabsTrigger value="content" className="text-xs">
              <Type className="mr-1 h-3 w-3" />
              Content
            </TabsTrigger>
            <TabsTrigger value="style" className="text-xs">
              <Palette className="mr-1 h-3 w-3" />
              Style
            </TabsTrigger>
            <TabsTrigger value="layout" className="text-xs">
              <Layout className="mr-1 h-3 w-3" />
              Layout
            </TabsTrigger>
          </TabsList>

          <div className="p-4">
            {/* Content Tab */}
            <TabsContent value="content" className="mt-0">
              <div className="space-y-4">
                {componentDef && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">
                        Component Settings
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {componentDef.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {componentDef.configurable.map(prop => (
                        <PropertyField
                          key={prop}
                          property={prop}
                          value={localProps[prop]}
                          onChange={value => updateProperty(prop, value)}
                          componentType={selectedElement.type}
                        />
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Shadcn Components Used */}
                {componentDef?.shadcnComponents &&
                  componentDef.shadcnComponents.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">
                          Shadcn Components
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Components from shadcn/ui used in this element
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1">
                          {componentDef.shadcnComponents.map(comp => (
                            <Badge
                              key={comp}
                              variant="secondary"
                              className="text-xs"
                            >
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
              </div>
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="mt-0">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Appearance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="color" className="text-xs">
                          Color
                        </Label>
                        <Input
                          id="color"
                          type="color"
                          value={selectedElement.styles?.color || '#000000'}
                          onChange={e => updateStyle('color', e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label htmlFor="background" className="text-xs">
                          Background
                        </Label>
                        <Input
                          id="background"
                          type="color"
                          value={
                            selectedElement.styles?.backgroundColor || '#ffffff'
                          }
                          onChange={e =>
                            updateStyle('backgroundColor', e.target.value)
                          }
                          className="h-8"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="fontSize" className="text-xs">
                        Font Size
                      </Label>
                      <Input
                        id="fontSize"
                        value={selectedElement.styles?.fontSize || ''}
                        onChange={e => updateStyle('fontSize', e.target.value)}
                        placeholder="16px, 1rem, etc."
                        className="h-8"
                      />
                    </div>

                    <div>
                      <Label htmlFor="textAlign" className="text-xs">
                        Text Align
                      </Label>
                      <Select
                        value={selectedElement.styles?.textAlign || 'left'}
                        onValueChange={value => updateStyle('textAlign', value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="justify">Justify</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Layout Tab */}
            <TabsContent value="layout" className="mt-0">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Spacing</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="margin" className="text-xs">
                          Margin
                        </Label>
                        <Input
                          id="margin"
                          value={selectedElement.styles?.margin || ''}
                          onChange={e => updateStyle('margin', e.target.value)}
                          placeholder="10px, 1rem, etc."
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label htmlFor="padding" className="text-xs">
                          Padding
                        </Label>
                        <Input
                          id="padding"
                          value={selectedElement.styles?.padding || ''}
                          onChange={e => updateStyle('padding', e.target.value)}
                          placeholder="10px, 1rem, etc."
                          className="h-8"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="width" className="text-xs">
                          Width
                        </Label>
                        <Input
                          id="width"
                          value={selectedElement.styles?.width || ''}
                          onChange={e => updateStyle('width', e.target.value)}
                          placeholder="100%, 300px, etc."
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label htmlFor="height" className="text-xs">
                          Height
                        </Label>
                        <Input
                          id="height"
                          value={selectedElement.styles?.height || ''}
                          onChange={e => updateStyle('height', e.target.value)}
                          placeholder="auto, 200px, etc."
                          className="h-8"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </ScrollArea>
    </div>
  )
}

interface PropertyFieldProps {
  property: string
  value: any
  onChange: (value: any) => void
  componentType: string | null
}

const PropertyField: React.FC<PropertyFieldProps> = ({
  property,
  value,
  onChange,
  componentType: _componentType,
}) => {
  const renderField = () => {
    // Determine field type based on property name and component type
    switch (property) {
      case 'text':
      case 'title':
      case 'name':
      case 'placeholder':
        return (
          <Input
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={`Enter ${property}...`}
            className="h-8"
          />
        )

      case 'content':
      case 'description':
      case 'message':
        return (
          <Textarea
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={`Enter ${property}...`}
            rows={3}
            className="resize-none"
          />
        )

      case 'size':
      case 'fontSize':
      case 'thickness':
        return (
          <div className="space-y-2">
            <Slider
              value={[value || 16]}
              onValueChange={values => onChange(values[0])}
              max={100}
              min={1}
              step={1}
            />
            <div className="text-right text-xs text-muted-foreground">
              {value || 16}px
            </div>
          </div>
        )

      case 'color':
      case 'backgroundColor':
      case 'foregroundColor':
        return (
          <Input
            type="color"
            value={value || '#000000'}
            onChange={e => onChange(e.target.value)}
            className="h-8"
          />
        )

      case 'autoplay':
      case 'controls':
      case 'loop':
      case 'showLineNumbers':
        return (
          <div className="flex items-center space-x-2">
            <Switch checked={value || false} onCheckedChange={onChange} />
            <span className="text-xs">{value ? 'Enabled' : 'Disabled'}</span>
          </div>
        )

      case 'level':
        return (
          <Select value={value || 'h1'} onValueChange={onChange}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="h1">H1</SelectItem>
              <SelectItem value="h2">H2</SelectItem>
              <SelectItem value="h3">H3</SelectItem>
              <SelectItem value="h4">H4</SelectItem>
              <SelectItem value="h5">H5</SelectItem>
              <SelectItem value="h6">H6</SelectItem>
            </SelectContent>
          </Select>
        )

      case 'alignment':
        return (
          <Select value={value || 'left'} onValueChange={onChange}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        )

      case 'style':
        return (
          <Select value={value || 'solid'} onValueChange={onChange}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="dashed">Dashed</SelectItem>
              <SelectItem value="dotted">Dotted</SelectItem>
              <SelectItem value="double">Double</SelectItem>
            </SelectContent>
          </Select>
        )

      default:
        return (
          <Input
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={`Enter ${property}...`}
            className="h-8"
          />
        )
    }
  }

  return (
    <div>
      <Label htmlFor={property} className="text-xs font-medium">
        {property.charAt(0).toUpperCase() +
          property.slice(1).replace(/([A-Z])/g, ' $1')}
      </Label>
      {renderField()}
    </div>
  )
}

export default PropertyEditor
