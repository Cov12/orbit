'use client'

import React, { useState, useMemo } from 'react'

import {
  Search,
  Type,
  FormInput,
  MousePointer,
  Image,
  ShoppingCart,
  Layout,
  Navigation,
  Star,
  BarChart,
  Sparkles,
  Building,
  Plus,
} from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EditorBtns } from '@/lib/constants'
import { FunnelComponentManager } from '@/lib/funnel-component-manager'
import { useEditor } from '@/providers/editor/editor-provider'

interface ComponentPaletteProps {
  className?: string
}

const categoryIcons = {
  content: Type,
  forms: FormInput,
  interactive: MousePointer,
  media: Image,
  ecommerce: ShoppingCart,
  layout: Layout,
  navigation: Navigation,
  'social-proof': Star,
  analytics: BarChart,
  animation: Sparkles,
  business: Building,
}

const ComponentPalette: React.FC<ComponentPaletteProps> = ({ className = '' }) => {
  const { dispatch } = useEditor()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeView, setActiveView] = useState<'categories' | 'search'>('categories')

  // Generate component palette data
  const componentPalette = useMemo(() =>
    FunnelComponentManager.generateComponentPalette(),
    []
  )

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return FunnelComponentManager.searchComponents(searchQuery)
  }, [searchQuery])

  const handleDragStart = (e: React.DragEvent, componentType: EditorBtns) => {
    if (componentType === null) return
    e.dataTransfer.setData('componentType', componentType)
  }

  const handleAddComponent = (componentType: EditorBtns) => {
    if (componentType === null) return

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
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setActiveView(query.trim() ? 'search' : 'categories')
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-3">Components</h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeView === 'categories' ? (
          <div className="p-4">
            <Accordion type="multiple" defaultValue={['content', 'forms']} className="w-full">
              {componentPalette.map((category) => {
                const CategoryIcon = categoryIcons[category.category as keyof typeof categoryIcons]

                return (
                  <AccordionItem key={category.category} value={category.category}>
                    <AccordionTrigger className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {CategoryIcon && <CategoryIcon className="h-4 w-4" />}
                        {category.label}
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {category.components.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-2 pt-2">
                        {category.components.map((component) => (
                          <ComponentCard
                            key={component.id}
                            component={component}
                            onDragStart={handleDragStart}
                            onAdd={handleAddComponent}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-3">
              <p className="text-sm text-muted-foreground">
                {searchResults.length} component{searchResults.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <div className="grid gap-2">
              {searchResults.map((component) => (
                <ComponentCard
                  key={component.id}
                  component={{
                    id: component.id,
                    name: component.name,
                    type: component.type,
                    icon: component.icon,
                    description: component.description,
                  }}
                  onDragStart={handleDragStart}
                  onAdd={handleAddComponent}
                  showCategory={true}
                />
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="text-xs text-muted-foreground text-center">
          Drag components to canvas or click + to add
        </div>
      </div>
    </div>
  )
}

interface ComponentCardProps {
  component: {
    id: string
    name: string
    type: string
    icon: string
    description: string
  }
  onDragStart: (e: React.DragEvent, type: EditorBtns) => void
  onAdd: (type: EditorBtns) => void
  showCategory?: boolean
}

const ComponentCard: React.FC<ComponentCardProps> = ({
  component,
  onDragStart,
  onAdd,
  showCategory = false,
}) => {
  const componentDef = FunnelComponentManager.getComponentDefinition(component.id)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, component.type as EditorBtns)}
      className="group relative p-3 border rounded-lg hover:border-primary/50 hover:bg-accent/50 cursor-grab active:cursor-grabbing transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-sm font-medium truncate">{component.name}</div>
            {showCategory && componentDef && (
              <Badge variant="outline" className="text-xs">
                {FunnelComponentManager['formatCategoryLabel'](componentDef.category)}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {component.description}
          </p>

          {/* Show shadcn components if available */}
          {componentDef?.shadcnComponents && componentDef.shadcnComponents.length > 0 && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1">
                {componentDef.shadcnComponents.slice(0, 2).map((shadcnComponent) => (
                  <Badge key={shadcnComponent} variant="secondary" className="text-xs">
                    {shadcnComponent}
                  </Badge>
                ))}
                {componentDef.shadcnComponents.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{componentDef.shadcnComponents.length - 2}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 shrink-0"
          onClick={() => onAdd(component.type as EditorBtns)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export default ComponentPalette