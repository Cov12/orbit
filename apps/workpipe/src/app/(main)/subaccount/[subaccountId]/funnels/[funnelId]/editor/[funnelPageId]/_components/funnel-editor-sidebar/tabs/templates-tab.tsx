'use client'

import React from 'react'

import {
  Layout,
  Sparkles,
  MousePointer,
  Users,
  Star,
  MessageSquare,
  Grid3X3,
  Image,
} from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

type Props = Record<string, never>

// Generate unique IDs
const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

interface SectionTemplate {
  name: string
  description: string
  icon: React.ElementType
  category: 'hero' | 'features' | 'cta' | 'testimonials' | 'gallery' | 'content'
  generateElement: () => EditorElement
}

const templates: SectionTemplate[] = [
  {
    name: 'Hero Section',
    description: 'Large heading with subtext and CTA button',
    icon: Layout,
    category: 'hero',
    generateElement: () => ({
      id: generateId(),
      name: 'Hero Section',
      type: 'container',
      styles: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 20px',
        textAlign: 'center',
        backgroundColor: '#f8fafc',
        minHeight: '400px',
      },
      content: [
        {
          id: generateId(),
          name: 'Heading',
          type: 'heading',
          styles: {},
          content: {
            text: 'Welcome to Our Platform',
            level: 'h1',
            alignment: 'center',
            fontSize: '3rem',
          },
        },
        {
          id: generateId(),
          name: 'Subtext',
          type: 'text',
          styles: {
            color: '#64748b',
            fontSize: '1.25rem',
            maxWidth: '600px',
            marginTop: '16px',
          },
          content: {
            innerText: 'Discover amazing features that will transform your business. Start your journey today.',
          },
        },
        {
          id: generateId(),
          name: 'CTA Button',
          type: 'button',
          styles: { marginTop: '32px' },
          content: {
            text: 'Get Started',
            href: '#',
            variant: 'primary',
            size: 'lg',
            backgroundColor: '#6366f1',
            textColor: '#ffffff',
          },
        },
      ],
    }),
  },
  {
    name: 'Feature Grid',
    description: '3-column feature cards with icons',
    icon: Grid3X3,
    category: 'features',
    generateElement: () => ({
      id: generateId(),
      name: 'Features Section',
      type: 'container',
      styles: {
        padding: '60px 20px',
        backgroundColor: '#ffffff',
      },
      content: [
        {
          id: generateId(),
          name: 'Section Title',
          type: 'heading',
          styles: { marginBottom: '40px' },
          content: {
            text: 'Our Features',
            level: 'h2',
            alignment: 'center',
          },
        },
        {
          id: generateId(),
          name: 'Three Columns',
          type: '3Col',
          styles: { display: 'flex', gap: '24px' },
          content: [
            {
              id: generateId(),
              name: 'Feature 1',
              type: 'container',
              styles: { width: '100%', padding: '24px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px' },
              content: [
                {
                  id: generateId(),
                  name: 'Icon',
                  type: 'icon',
                  styles: { marginBottom: '16px' },
                  content: { iconName: 'star', size: 40, color: '#6366f1' },
                },
                {
                  id: generateId(),
                  name: 'Title',
                  type: 'heading',
                  styles: {},
                  content: { text: 'Feature One', level: 'h3', alignment: 'center' },
                },
                {
                  id: generateId(),
                  name: 'Description',
                  type: 'text',
                  styles: { color: '#64748b', marginTop: '8px' },
                  content: { innerText: 'Description of this amazing feature that helps users.' },
                },
              ],
            },
            {
              id: generateId(),
              name: 'Feature 2',
              type: 'container',
              styles: { width: '100%', padding: '24px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px' },
              content: [
                {
                  id: generateId(),
                  name: 'Icon',
                  type: 'icon',
                  styles: { marginBottom: '16px' },
                  content: { iconName: 'heart', size: 40, color: '#6366f1' },
                },
                {
                  id: generateId(),
                  name: 'Title',
                  type: 'heading',
                  styles: {},
                  content: { text: 'Feature Two', level: 'h3', alignment: 'center' },
                },
                {
                  id: generateId(),
                  name: 'Description',
                  type: 'text',
                  styles: { color: '#64748b', marginTop: '8px' },
                  content: { innerText: 'Another great feature that your users will love.' },
                },
              ],
            },
            {
              id: generateId(),
              name: 'Feature 3',
              type: 'container',
              styles: { width: '100%', padding: '24px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px' },
              content: [
                {
                  id: generateId(),
                  name: 'Icon',
                  type: 'icon',
                  styles: { marginBottom: '16px' },
                  content: { iconName: 'check', size: 40, color: '#6366f1' },
                },
                {
                  id: generateId(),
                  name: 'Title',
                  type: 'heading',
                  styles: {},
                  content: { text: 'Feature Three', level: 'h3', alignment: 'center' },
                },
                {
                  id: generateId(),
                  name: 'Description',
                  type: 'text',
                  styles: { color: '#64748b', marginTop: '8px' },
                  content: { innerText: 'The third feature that completes the experience.' },
                },
              ],
            },
          ],
        },
      ],
    }),
  },
  {
    name: 'CTA Banner',
    description: 'Call-to-action with background',
    icon: MousePointer,
    category: 'cta',
    generateElement: () => ({
      id: generateId(),
      name: 'CTA Section',
      type: 'container',
      styles: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center',
        backgroundColor: '#6366f1',
        color: '#ffffff',
      },
      content: [
        {
          id: generateId(),
          name: 'CTA Heading',
          type: 'heading',
          styles: { color: '#ffffff' },
          content: {
            text: 'Ready to Get Started?',
            level: 'h2',
            alignment: 'center',
            color: '#ffffff',
          },
        },
        {
          id: generateId(),
          name: 'CTA Text',
          type: 'text',
          styles: { color: '#e0e7ff', marginTop: '12px', maxWidth: '500px' },
          content: { innerText: 'Join thousands of satisfied customers today.' },
        },
        {
          id: generateId(),
          name: 'CTA Button',
          type: 'button',
          styles: { marginTop: '24px' },
          content: {
            text: 'Start Free Trial',
            href: '#',
            variant: 'secondary',
            size: 'lg',
            backgroundColor: '#ffffff',
            textColor: '#6366f1',
          },
        },
      ],
    }),
  },
  {
    name: 'Testimonial Card',
    description: 'Customer quote with avatar',
    icon: MessageSquare,
    category: 'testimonials',
    generateElement: () => ({
      id: generateId(),
      name: 'Testimonial',
      type: 'container',
      styles: {
        padding: '40px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        maxWidth: '500px',
        margin: '0 auto',
      },
      content: [
        {
          id: generateId(),
          name: 'Quote',
          type: 'text',
          styles: { fontSize: '1.125rem', fontStyle: 'italic', color: '#374151' },
          content: { innerText: '"This product has completely transformed how we do business. Highly recommended!"' },
        },
        {
          id: generateId(),
          name: 'Author Section',
          type: '2Col',
          styles: { display: 'flex', alignItems: 'center', marginTop: '24px', gap: '16px' },
          content: [
            {
              id: generateId(),
              name: 'Avatar',
              type: 'container',
              styles: {
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              },
              content: [
                {
                  id: generateId(),
                  name: 'Icon',
                  type: 'icon',
                  styles: {},
                  content: { iconName: 'user', size: 24, color: '#ffffff' },
                },
              ],
            },
            {
              id: generateId(),
              name: 'Author Info',
              type: 'container',
              styles: { width: '100%' },
              content: [
                {
                  id: generateId(),
                  name: 'Name',
                  type: 'text',
                  styles: { fontWeight: 'bold', color: '#111827' },
                  content: { innerText: 'John Doe' },
                },
                {
                  id: generateId(),
                  name: 'Title',
                  type: 'text',
                  styles: { color: '#6b7280', fontSize: '0.875rem' },
                  content: { innerText: 'CEO, Example Company' },
                },
              ],
            },
          ],
        },
      ],
    }),
  },
  {
    name: 'Image Gallery',
    description: '3-column image grid',
    icon: Image,
    category: 'gallery',
    generateElement: () => ({
      id: generateId(),
      name: 'Gallery Section',
      type: 'container',
      styles: { padding: '40px 20px' },
      content: [
        {
          id: generateId(),
          name: 'Gallery Title',
          type: 'heading',
          styles: { marginBottom: '32px' },
          content: { text: 'Our Gallery', level: 'h2', alignment: 'center' },
        },
        {
          id: generateId(),
          name: 'Image Grid',
          type: '3Col',
          styles: { display: 'flex', gap: '16px' },
          content: [
            {
              id: generateId(),
              name: 'Image 1',
              type: 'image',
              styles: { width: '100%', borderRadius: '12px' },
              content: { src: '', alt: 'Gallery image 1', objectFit: 'cover', height: '200px' },
            },
            {
              id: generateId(),
              name: 'Image 2',
              type: 'image',
              styles: { width: '100%', borderRadius: '12px' },
              content: { src: '', alt: 'Gallery image 2', objectFit: 'cover', height: '200px' },
            },
            {
              id: generateId(),
              name: 'Image 3',
              type: 'image',
              styles: { width: '100%', borderRadius: '12px' },
              content: { src: '', alt: 'Gallery image 3', objectFit: 'cover', height: '200px' },
            },
          ],
        },
      ],
    }),
  },
  {
    name: 'Stats Section',
    description: 'Key numbers and metrics',
    icon: Sparkles,
    category: 'content',
    generateElement: () => ({
      id: generateId(),
      name: 'Stats Section',
      type: 'container',
      styles: {
        padding: '60px 20px',
        backgroundColor: '#1e1b4b',
      },
      content: [
        {
          id: generateId(),
          name: 'Stats Grid',
          type: '3Col',
          styles: { display: 'flex', gap: '32px', textAlign: 'center' },
          content: [
            {
              id: generateId(),
              name: 'Stat 1',
              type: 'container',
              styles: { width: '100%' },
              content: [
                {
                  id: generateId(),
                  name: 'Number',
                  type: 'heading',
                  styles: { color: '#ffffff' },
                  content: { text: '10K+', level: 'h2', alignment: 'center', color: '#ffffff', fontSize: '3rem' },
                },
                {
                  id: generateId(),
                  name: 'Label',
                  type: 'text',
                  styles: { color: '#a5b4fc', marginTop: '8px' },
                  content: { innerText: 'Happy Customers' },
                },
              ],
            },
            {
              id: generateId(),
              name: 'Stat 2',
              type: 'container',
              styles: { width: '100%' },
              content: [
                {
                  id: generateId(),
                  name: 'Number',
                  type: 'heading',
                  styles: { color: '#ffffff' },
                  content: { text: '99%', level: 'h2', alignment: 'center', color: '#ffffff', fontSize: '3rem' },
                },
                {
                  id: generateId(),
                  name: 'Label',
                  type: 'text',
                  styles: { color: '#a5b4fc', marginTop: '8px' },
                  content: { innerText: 'Satisfaction Rate' },
                },
              ],
            },
            {
              id: generateId(),
              name: 'Stat 3',
              type: 'container',
              styles: { width: '100%' },
              content: [
                {
                  id: generateId(),
                  name: 'Number',
                  type: 'heading',
                  styles: { color: '#ffffff' },
                  content: { text: '24/7', level: 'h2', alignment: 'center', color: '#ffffff', fontSize: '3rem' },
                },
                {
                  id: generateId(),
                  name: 'Label',
                  type: 'text',
                  styles: { color: '#a5b4fc', marginTop: '8px' },
                  content: { innerText: 'Support Available' },
                },
              ],
            },
          ],
        },
      ],
    }),
  },
]

const TemplateCard = ({ template }: { template: SectionTemplate }) => {
  const { dispatch, state } = useEditor()

  const handleDragStart = (e: React.DragEvent) => {
    // Store template data for drop
    e.dataTransfer.setData('templateName', template.name)
  }

  const handleClick = () => {
    // Add template to body
    const element = template.generateElement()
    dispatch({
      type: 'ADD_ELEMENT',
      payload: {
        containerId: '__body',
        elementDetails: element,
      },
    })
  }

  const Icon = template.icon

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium">{template.name}</h4>
          <p className="text-xs text-muted-foreground">{template.description}</p>
        </div>
      </div>
    </div>
  )
}

const TemplatesTab = (props: Props) => {
  const categories = [
    { key: 'hero', label: 'Hero Sections' },
    { key: 'features', label: 'Features' },
    { key: 'cta', label: 'Call to Action' },
    { key: 'testimonials', label: 'Testimonials' },
    { key: 'gallery', label: 'Gallery' },
    { key: 'content', label: 'Content' },
  ]

  return (
    <ScrollArea className="h-[calc(100vh-250px)]">
      <div className="flex flex-col gap-6 p-4">
        {categories.map(category => {
          const categoryTemplates = templates.filter(t => t.category === category.key)
          if (categoryTemplates.length === 0) return null

          return (
            <div key={category.key}>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                {category.label}
              </h3>
              <div className="flex flex-col gap-2">
                {categoryTemplates.map(template => (
                  <TemplateCard key={template.name} template={template} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

export default TemplatesTab
