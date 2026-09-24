# Funnel Builder System

A comprehensive drag-and-drop funnel builder system with **mandatory shadcn MCP integration** for WorkPipe.

## 🏗️ Architecture Overview

### Core Components

1. **FunnelEditor** - Main editor layout with header, canvas, and sidebar
2. **FunnelEditorCanvas** - Drag-and-drop canvas with responsive preview
3. **EditorSidebar** - Tabbed sidebar with components, properties, layers, and history
4. **ComponentRegistry** - Central component mapping and rendering system
5. **BaseFunnelComponent** - Base wrapper providing common editor functionality

### Component Categories (12 Total)

1. **Content Components** ✅ **IMPLEMENTED**
   - Heading, Animated Text, Rich Text Editor
   - Icon, Divider, Spacer, Code Block, QR Code

2. **Form Components** 📋 **DEFINED**
   - Newsletter Signup, Survey/Quiz, File Upload
   - Date Picker, Phone Input

3. **Interactive Components** 🎯 **DEFINED**
   - Button, Tabs, Accordion, Modal, Tooltip, Dropdown

4. **Media Components** 🎬 **DEFINED**
   - Image Gallery, Image Carousel, Audio Player

5. **E-commerce Components** 🛒 **DEFINED**
   - Product Card, Price Table, Rating

6. **Layout Components** 📐 **DEFINED**
   - Card, Container, Grid System

7. **Navigation Components** 🧭 **DEFINED**
   - Navigation Bar (18 variants), Breadcrumbs, Pagination

8. **Social Proof Components** ⭐ **DEFINED**
   - Testimonials, Logo Grid

9. **Analytics Components** 📊 **DEFINED**
   - Conversion Pixels, Tracking

10. **Animation Components** ✨ **DEFINED**
    - Animated Counter, Particles, Background Effects

11. **Business Components** 💼 **DEFINED**
    - Appointment Booking, Lead Magnets

## 🎨 Shadcn MCP Integration

### Mandatory Usage

**ALL UI components MUST use shadcn MCP** as specified in:
- `docs/PRD.md`
- `docs/Technical-Implementation-Plan.md`
- `CLAUDE.md`

### Component Mapping

Each funnel component maps to specific shadcn MCP components:

```typescript
// Example: Animated Text Component
shadcnComponents: [
  'text-generate-effect',
  'typing-text',
  'rolling-text',
  'splitting-text'
]
```

### Current Integrations

- **Text Effects**: text-generate-effect, typing-text
- **Rich Text**: minimal-tiptap
- **Code Display**: code-block
- **QR Codes**: qr-code
- **Testimonials**: animated-testimonials
- **Navigation**: navbar-01 through navbar-18
- **Interactive**: animated-modal, animated-tooltip

## 🚀 Usage

### Basic Implementation

```tsx
import { FunnelEditor } from '@/components/funnel-builder'

export default function FunnelEditorPage() {
  return (
    <FunnelEditor
      funnelPageId="page-123"
      funnelId="funnel-456"
      subaccountId="sub-789"
      pageDetails={{
        name: "Landing Page",
        pathName: "landing",
        order: 0
      }}
      onSave={handleSave}
      onPreview={handlePreview}
      onBack={handleBack}
    />
  )
}
```

### Adding New Components

1. **Define Component**:
```typescript
// In funnel-components.ts
const newComponent: FunnelComponentDefinition = {
  id: 'my-component',
  name: 'My Component',
  category: 'interactive',
  type: 'my-component',
  icon: 'Star',
  description: 'Custom component description',
  defaultProps: { /* defaults */ },
  configurable: ['prop1', 'prop2'],
  shadcnComponents: ['button', 'card'] // MANDATORY
}
```

2. **Create React Component**:
```tsx
// In components/funnel-builder/interactive/my-component.tsx
import React from 'react'
import { EditorElement } from '@/providers/editor/editor-provider'
import BaseFunnelComponent from '../base-funnel-component'

const MyComponent: React.FC<{ element: EditorElement }> = ({ element }) => {
  return (
    <BaseFunnelComponent element={element}>
      {/* Your component implementation */}
    </BaseFunnelComponent>
  )
}

export default MyComponent
```

3. **Register in ComponentRegistry**:
```tsx
// In component-registry.tsx
case 'my-component':
  return <MyComponent element={element} />
```

### Component Manager Usage

```typescript
import { FunnelComponentManager } from '@/lib/funnel-component-manager'

// Get all categories
const categories = FunnelComponentManager.getCategories()

// Search components
const results = FunnelComponentManager.searchComponents('button')

// Create new element
const componentDef = FunnelComponentManager.getComponentDefinitionByType('heading')
const element = FunnelComponentManager.createElement(componentDef, 'container-id')

// Get shadcn dependencies
const shadcnComponents = FunnelComponentManager.getShadcnComponents('heading')
```

## 📁 File Structure

```
src/components/funnel-builder/
├── README.md                           # This file
├── index.ts                           # Main exports
├── funnel-editor.tsx                  # Main editor layout
├── funnel-editor-canvas.tsx           # Canvas component
├── component-registry.tsx             # Component mapping
├── base-funnel-component.tsx          # Base wrapper
├── content/                           # Content components
│   ├── index.ts
│   ├── heading-component.tsx
│   ├── animated-text-component.tsx
│   ├── rich-text-component.tsx
│   ├── icon-component.tsx
│   ├── divider-component.tsx
│   ├── spacer-component.tsx
│   ├── code-block-component.tsx
│   └── qr-code-component.tsx
└── editor-sidebar/                    # Sidebar components
    ├── index.tsx                      # Main sidebar
    ├── component-palette.tsx          # Component browser
    └── property-editor.tsx            # Property editor

src/lib/
├── funnel-components.ts               # Component definitions
└── funnel-component-manager.ts        # Management utilities
```

## 🔧 Features

### Editor Features
- ✅ Drag-and-drop interface
- ✅ Responsive preview (Desktop/Tablet/Mobile)
- ✅ Live/Preview mode toggle
- ✅ Undo/Redo system
- ✅ Component search and categorization
- ✅ Property editor with visual controls
- ✅ Auto-save and manual save
- ✅ Keyboard shortcuts

### Component Features
- ✅ Visual selection indicators
- ✅ Delete/clone/duplicate actions
- ✅ Real-time property updates
- ✅ Style and layout controls
- ✅ Component-specific configuration
- ✅ Shadcn MCP integration

### Developer Features
- ✅ TypeScript support
- ✅ Component validation
- ✅ Extensible architecture
- ✅ Comprehensive error handling
- ✅ Performance optimizations

## 🎯 Integration Points

### Existing Editor Integration

The new system is designed to integrate with the existing funnel editor at:
```
src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/
```

Replace the existing editor with:
```tsx
import { FunnelEditor } from '@/components/funnel-builder'

// Replace existing editor implementation
<FunnelEditor
  funnelPageId={params.funnelPageId}
  funnelId={params.funnelId}
  subaccountId={params.subaccountId}
  pageDetails={pageDetails}
/>
```

### Database Integration

The system works with the existing EditorElement structure but extends it to support the new component types defined in `EditorBtns`.

## 🚦 Next Steps

### Phase 1: Content Components ✅ COMPLETED
- All 8 content components implemented
- Full shadcn MCP integration
- Property editor support

### Phase 2: Interactive & Form Components
- Implement remaining 11 component categories
- Add advanced property editors
- Implement component-specific behaviors

### Phase 3: Advanced Features
- Template system
- Component library
- Version history
- A/B testing framework

## 📚 Resources

- [shadcn/ui Components](https://ui.shadcn.com/components)
- [WorkPipe PRD](../../docs/PRD.md)
- [Technical Implementation Plan](../../docs/Technical-Implementation-Plan.md)
- [Development Guidelines](../../CLAUDE.md)

## 🤝 Contributing

When adding new components:

1. **MUST** use shadcn MCP for all UI elements
2. Follow the existing component structure
3. Add proper TypeScript types
4. Include component in the registry
5. Add property editor support
6. Update documentation

---

**Note**: This system replaces the existing funnel editor with a more comprehensive, extensible solution that leverages the full power of shadcn/ui components through the MCP system.