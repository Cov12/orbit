/**
 * Comprehensive Funnel Builder Component Registry
 * Using shadcn MCP for all UI components
 */

import { EditorBtns } from '@/lib/constants'

export interface FunnelComponentDefinition {
  id: string
  name: string
  category: FunnelComponentCategory
  type: EditorBtns | string
  icon: string
  description: string
  defaultProps: Record<string, any>
  configurable: string[]
  shadcnComponents?: string[] // Maps to shadcn MCP components
}

export type FunnelComponentCategory =
  | 'content'
  | 'forms'
  | 'interactive'
  | 'media'
  | 'ecommerce'
  | 'layout'
  | 'navigation'
  | 'social-proof'
  | 'analytics'
  | 'animation'
  | 'business'

// Content Components
export const contentComponents: FunnelComponentDefinition[] = [
  {
    id: 'heading',
    name: 'Heading',
    category: 'content',
    type: 'heading',
    icon: 'Type',
    description: 'Multiple heading levels (H1-H6) with customizable styling',
    defaultProps: {
      level: 'h1',
      text: 'Your Heading Here',
      alignment: 'left',
      color: '#000000',
      fontSize: '2rem',
    },
    configurable: ['level', 'text', 'alignment', 'color', 'fontSize'],
    shadcnComponents: ['text-generate-effect', 'gradient-text'],
  },
  {
    id: 'text-block',
    name: 'Text Block',
    category: 'content',
    type: 'text',
    icon: 'AlignLeft',
    description: 'Rich text editor with formatting options',
    defaultProps: {
      content: 'Your text content here...',
      alignment: 'left',
      fontSize: '1rem',
      color: '#333333',
    },
    configurable: ['content', 'alignment', 'fontSize', 'color'],
    shadcnComponents: ['minimal-tiptap', 'highlight-text'],
  },
  {
    id: 'rich-text-editor',
    name: 'Rich Text Editor',
    category: 'content',
    type: 'rich-text',
    icon: 'Edit3',
    description: 'Advanced text editing with formatting toolbar',
    defaultProps: {
      content: '',
      toolbar: true,
      placeholder: 'Start typing...',
    },
    configurable: ['content', 'toolbar', 'placeholder'],
    shadcnComponents: ['minimal-tiptap'],
  },
  {
    id: 'animated-text',
    name: 'Animated Text',
    category: 'content',
    type: 'animated-text',
    icon: 'Zap',
    description: 'Text with animation effects',
    defaultProps: {
      text: 'Animated Text',
      animation: 'typing',
      speed: 50,
    },
    configurable: ['text', 'animation', 'speed'],
    shadcnComponents: ['text-generate-effect', 'typing-text', 'rolling-text', 'splitting-text'],
  },
  {
    id: 'image',
    name: 'Image',
    category: 'content',
    type: 'image',
    icon: 'Image',
    description: 'Single image with alignment, sizing, and link options',
    defaultProps: {
      src: '/placeholder-image.jpg',
      alt: 'Image description',
      width: '100%',
      height: 'auto',
      link: '',
    },
    configurable: ['src', 'alt', 'width', 'height', 'link'],
    shadcnComponents: ['image-zoom'],
  },
  {
    id: 'video',
    name: 'Video',
    category: 'content',
    type: 'video',
    icon: 'Video',
    description: 'Embedded video player (YouTube, Vimeo, self-hosted)',
    defaultProps: {
      src: '',
      autoplay: false,
      controls: true,
      loop: false,
    },
    configurable: ['src', 'autoplay', 'controls', 'loop'],
    shadcnComponents: ['video-player'],
  },
  {
    id: 'icon',
    name: 'Icon',
    category: 'content',
    type: 'icon',
    icon: 'Star',
    description: 'Icon library with customizable size and color',
    defaultProps: {
      iconName: 'star',
      size: 24,
      color: '#000000',
    },
    configurable: ['iconName', 'size', 'color'],
    shadcnComponents: ['icon-button'],
  },
  {
    id: 'divider',
    name: 'Divider/Separator',
    category: 'content',
    type: 'divider',
    icon: 'Minus',
    description: 'Horizontal lines with various styles',
    defaultProps: {
      style: 'solid',
      thickness: 1,
      color: '#e5e5e5',
      margin: '20px',
    },
    configurable: ['style', 'thickness', 'color', 'margin'],
    shadcnComponents: [],
  },
  {
    id: 'spacer',
    name: 'Spacer',
    category: 'content',
    type: 'spacer',
    icon: 'ArrowUpDown',
    description: 'Adjustable vertical spacing element',
    defaultProps: {
      height: '50px',
    },
    configurable: ['height'],
    shadcnComponents: [],
  },
  {
    id: 'code-block',
    name: 'Code Block',
    category: 'content',
    type: 'code-block',
    icon: 'Code',
    description: 'Syntax highlighted code display',
    defaultProps: {
      code: 'console.log("Hello World");',
      language: 'javascript',
      theme: 'dark',
    },
    configurable: ['code', 'language', 'theme'],
    shadcnComponents: ['code-block'],
  },
  {
    id: 'snippet',
    name: 'Snippet',
    category: 'content',
    type: 'snippet',
    icon: 'Quote',
    description: 'Quote or testimonial snippet',
    defaultProps: {
      text: 'This is a great quote or testimonial.',
      author: 'John Doe',
      role: 'CEO, Company',
    },
    configurable: ['text', 'author', 'role'],
    shadcnComponents: ['snippet'],
  },
  {
    id: 'qr-code',
    name: 'QR Code',
    category: 'content',
    type: 'qr-code',
    icon: 'QrCode',
    description: 'QR code for mobile links',
    defaultProps: {
      value: 'https://example.com',
      size: 200,
      backgroundColor: '#ffffff',
      foregroundColor: '#000000',
    },
    configurable: ['value', 'size', 'backgroundColor', 'foregroundColor'],
    shadcnComponents: ['qr-code'],
  },
]

// Form Components
export const formComponents: FunnelComponentDefinition[] = [
  {
    id: 'contact-form',
    name: 'Contact Form',
    category: 'forms',
    type: 'contactForm',
    icon: 'Mail',
    description: 'Multi-field contact capture form',
    defaultProps: {
      title: 'Contact Us',
      subtitle: 'Get in touch with us',
      fields: ['name', 'email', 'phone', 'message'],
      submitText: 'Send Message',
    },
    configurable: ['title', 'subtitle', 'fields', 'submitText'],
    shadcnComponents: ['contact-form'],
  },
  {
    id: 'newsletter-signup',
    name: 'Newsletter Signup',
    category: 'forms',
    type: 'newsletter',
    icon: 'Send',
    description: 'Email capture with validation',
    defaultProps: {
      title: 'Subscribe to our newsletter',
      placeholder: 'Enter your email',
      buttonText: 'Subscribe',
    },
    configurable: ['title', 'placeholder', 'buttonText'],
    shadcnComponents: ['input', 'button'],
  },
  {
    id: 'survey-quiz',
    name: 'Survey/Quiz',
    category: 'forms',
    type: 'survey',
    icon: 'ClipboardList',
    description: 'Multi-step form builder',
    defaultProps: {
      title: 'Survey',
      questions: [],
      submitText: 'Submit',
    },
    configurable: ['title', 'questions', 'submitText'],
    shadcnComponents: ['choicebox', 'radio-group'],
  },
  {
    id: 'file-upload',
    name: 'File Upload',
    category: 'forms',
    type: 'file-upload',
    icon: 'Upload',
    description: 'Document upload with drag and drop',
    defaultProps: {
      acceptedTypes: ['image/*', '.pdf'],
      maxSize: '10MB',
      multiple: false,
    },
    configurable: ['acceptedTypes', 'maxSize', 'multiple'],
    shadcnComponents: ['dropzone'],
  },
  {
    id: 'date-picker',
    name: 'Date Picker',
    category: 'forms',
    type: 'date-picker',
    icon: 'Calendar',
    description: 'Calendar component for scheduling',
    defaultProps: {
      label: 'Select Date',
      format: 'MM/dd/yyyy',
      minDate: null,
      maxDate: null,
    },
    configurable: ['label', 'format', 'minDate', 'maxDate'],
    shadcnComponents: ['calendar'],
  },
  {
    id: 'phone-input',
    name: 'Phone Input',
    category: 'forms',
    type: 'phone-input',
    icon: 'Phone',
    description: 'Formatted phone number field',
    defaultProps: {
      label: 'Phone Number',
      placeholder: '(555) 123-4567',
      countryCode: 'US',
    },
    configurable: ['label', 'placeholder', 'countryCode'],
    shadcnComponents: ['input'],
  },
]

// Interactive Components
export const interactiveComponents: FunnelComponentDefinition[] = [
  {
    id: 'button',
    name: 'Button',
    category: 'interactive',
    type: 'button',
    icon: 'MousePointer',
    description: 'Primary/secondary buttons with animations',
    defaultProps: {
      text: 'Click Me',
      variant: 'primary',
      size: 'medium',
      link: '',
      animation: 'none',
    },
    configurable: ['text', 'variant', 'size', 'link', 'animation'],
    shadcnComponents: ['button', 'ripple-button', 'liquid-button', 'magnetic-button'],
  },
  {
    id: 'tabs',
    name: 'Tabs',
    category: 'interactive',
    type: 'tabs',
    icon: 'Tabs',
    description: 'Content organization with tabs',
    defaultProps: {
      tabs: [
        { id: '1', label: 'Tab 1', content: 'Content 1' },
        { id: '2', label: 'Tab 2', content: 'Content 2' },
      ],
      orientation: 'horizontal',
    },
    configurable: ['tabs', 'orientation'],
    shadcnComponents: ['tabs'],
  },
  {
    id: 'accordion',
    name: 'Accordion',
    category: 'interactive',
    type: 'accordion',
    icon: 'ChevronDown',
    description: 'Collapsible content sections',
    defaultProps: {
      items: [
        { id: '1', title: 'Section 1', content: 'Content 1' },
        { id: '2', title: 'Section 2', content: 'Content 2' },
      ],
      allowMultiple: false,
    },
    configurable: ['items', 'allowMultiple'],
    shadcnComponents: ['accordion'],
  },
  {
    id: 'modal',
    name: 'Modal/Dialog',
    category: 'interactive',
    type: 'modal',
    icon: 'Square',
    description: 'Popup content overlay',
    defaultProps: {
      triggerText: 'Open Modal',
      title: 'Modal Title',
      content: 'Modal content goes here',
      size: 'medium',
    },
    configurable: ['triggerText', 'title', 'content', 'size'],
    shadcnComponents: ['dialog', 'animated-modal'],
  },
  {
    id: 'tooltip',
    name: 'Tooltip',
    category: 'interactive',
    type: 'tooltip',
    icon: 'Info',
    description: 'Animated tooltip for help text',
    defaultProps: {
      text: 'Tooltip text',
      position: 'top',
      trigger: 'hover',
    },
    configurable: ['text', 'position', 'trigger'],
    shadcnComponents: ['animated-tooltip'],
  },
  {
    id: 'dropdown',
    name: 'Dropdown Menu',
    category: 'interactive',
    type: 'dropdown',
    icon: 'ChevronDown',
    description: 'Navigation or selection dropdown',
    defaultProps: {
      triggerText: 'Menu',
      items: ['Option 1', 'Option 2', 'Option 3'],
    },
    configurable: ['triggerText', 'items'],
    shadcnComponents: ['dropdown-menu'],
  },
]

// Media Components
export const mediaComponents: FunnelComponentDefinition[] = [
  {
    id: 'image-gallery',
    name: 'Image Gallery',
    category: 'media',
    type: 'image-gallery',
    icon: 'Images',
    description: 'Multiple images with navigation',
    defaultProps: {
      images: [],
      layout: 'grid',
      columns: 3,
      spacing: '10px',
    },
    configurable: ['images', 'layout', 'columns', 'spacing'],
    shadcnComponents: ['image-crop', 'image-zoom'],
  },
  {
    id: 'image-carousel',
    name: 'Image Carousel',
    category: 'media',
    type: 'image-carousel',
    icon: 'ArrowLeftRight',
    description: 'Image slideshow with navigation',
    defaultProps: {
      images: [],
      autoplay: false,
      interval: 5000,
      showDots: true,
    },
    configurable: ['images', 'autoplay', 'interval', 'showDots'],
    shadcnComponents: ['apple-cards-carousel'],
  },
  {
    id: 'audio-player',
    name: 'Audio Player',
    category: 'media',
    type: 'audio-player',
    icon: 'Volume2',
    description: 'Embedded audio content player',
    defaultProps: {
      src: '',
      autoplay: false,
      loop: false,
      controls: true,
    },
    configurable: ['src', 'autoplay', 'loop', 'controls'],
    shadcnComponents: [],
  },
]

// E-commerce Components
export const ecommerceComponents: FunnelComponentDefinition[] = [
  {
    id: 'product-card',
    name: 'Product Card',
    category: 'ecommerce',
    type: 'product-card',
    icon: 'ShoppingBag',
    description: 'Single product display card',
    defaultProps: {
      name: 'Product Name',
      price: '$99.99',
      image: '/placeholder-product.jpg',
      description: 'Product description',
    },
    configurable: ['name', 'price', 'image', 'description'],
    shadcnComponents: ['card'],
  },
  {
    id: 'price-table',
    name: 'Price Table',
    category: 'ecommerce',
    type: 'price-table',
    icon: 'DollarSign',
    description: 'Pricing comparison table',
    defaultProps: {
      plans: [
        { name: 'Basic', price: '$9.99', features: ['Feature 1', 'Feature 2'] },
        { name: 'Pro', price: '$19.99', features: ['Feature 1', 'Feature 2', 'Feature 3'] },
      ],
    },
    configurable: ['plans'],
    shadcnComponents: ['table'],
  },
  {
    id: 'checkout-form',
    name: 'Checkout Form',
    category: 'ecommerce',
    type: 'paymentForm',
    icon: 'CreditCard',
    description: 'Payment processing form (Stripe integration)',
    defaultProps: {
      title: 'Complete Your Purchase',
      currency: 'USD',
      amount: 0,
    },
    configurable: ['title', 'currency', 'amount'],
    shadcnComponents: ['credit-card'],
  },
  {
    id: 'rating',
    name: 'Rating',
    category: 'ecommerce',
    type: 'rating',
    icon: 'Star',
    description: 'Star rating system',
    defaultProps: {
      rating: 5,
      maxRating: 5,
      readOnly: false,
      size: 'medium',
    },
    configurable: ['rating', 'maxRating', 'readOnly', 'size'],
    shadcnComponents: ['rating'],
  },
]

// Layout Components
export const layoutComponents: FunnelComponentDefinition[] = [
  {
    id: 'container',
    name: 'Container',
    category: 'layout',
    type: 'container',
    icon: 'Box',
    description: 'Content width wrapper',
    defaultProps: {
      maxWidth: '1200px',
      padding: '20px',
      centered: true,
    },
    configurable: ['maxWidth', 'padding', 'centered'],
    shadcnComponents: [],
  },
  {
    id: 'section',
    name: 'Section',
    category: 'layout',
    type: 'section',
    icon: 'Layout',
    description: 'Page section wrapper',
    defaultProps: {
      backgroundColor: '#ffffff',
      padding: '60px 20px',
      fullWidth: true,
    },
    configurable: ['backgroundColor', 'padding', 'fullWidth'],
    shadcnComponents: [],
  },
  {
    id: '2-column',
    name: '2 Column Layout',
    category: 'layout',
    type: '2Col',
    icon: 'Columns',
    description: 'Two column responsive layout',
    defaultProps: {
      ratio: '50/50',
      gap: '20px',
      stackOnMobile: true,
    },
    configurable: ['ratio', 'gap', 'stackOnMobile'],
    shadcnComponents: [],
  },
  {
    id: '3-column',
    name: '3 Column Layout',
    category: 'layout',
    type: '3Col',
    icon: 'Columns',
    description: 'Three column responsive layout',
    defaultProps: {
      ratio: '33/33/33',
      gap: '20px',
      stackOnMobile: true,
    },
    configurable: ['ratio', 'gap', 'stackOnMobile'],
    shadcnComponents: [],
  },
  {
    id: 'card',
    name: 'Card',
    category: 'layout',
    type: 'card',
    icon: 'Square',
    description: 'Content grouping with shadows',
    defaultProps: {
      shadow: 'medium',
      borderRadius: '8px',
      padding: '20px',
    },
    configurable: ['shadow', 'borderRadius', 'padding'],
    shadcnComponents: ['card'],
  },
]

// Navigation Components
export const navigationComponents: FunnelComponentDefinition[] = [
  {
    id: 'navbar',
    name: 'Navigation Bar',
    category: 'navigation',
    type: 'navbar',
    icon: 'Menu',
    description: 'Website navigation header',
    defaultProps: {
      brand: 'Brand',
      links: ['Home', 'About', 'Services', 'Contact'],
      style: 'horizontal',
    },
    configurable: ['brand', 'links', 'style'],
    shadcnComponents: ['navbar-01', 'navbar-02', 'navbar-03'], // Can use any of the 18 navbar variants
  },
  {
    id: 'breadcrumbs',
    name: 'Breadcrumbs',
    category: 'navigation',
    type: 'breadcrumbs',
    icon: 'ChevronRight',
    description: 'Page hierarchy navigation',
    defaultProps: {
      items: ['Home', 'Category', 'Current Page'],
      separator: '/',
    },
    configurable: ['items', 'separator'],
    shadcnComponents: [],
  },
  {
    id: 'pagination',
    name: 'Pagination',
    category: 'navigation',
    type: 'pagination',
    icon: 'MoreHorizontal',
    description: 'Content page navigation',
    defaultProps: {
      currentPage: 1,
      totalPages: 10,
      showPageNumbers: true,
    },
    configurable: ['currentPage', 'totalPages', 'showPageNumbers'],
    shadcnComponents: [],
  },
]

// Social Proof Components
export const socialProofComponents: FunnelComponentDefinition[] = [
  {
    id: 'testimonial',
    name: 'Testimonial',
    category: 'social-proof',
    type: 'testimonial',
    icon: 'MessageSquare',
    description: 'Customer review display',
    defaultProps: {
      text: 'This product changed my life!',
      author: 'Jane Doe',
      role: 'Customer',
      avatar: '/placeholder-avatar.jpg',
      rating: 5,
    },
    configurable: ['text', 'author', 'role', 'avatar', 'rating'],
    shadcnComponents: ['animated-testimonials'],
  },
  {
    id: 'logo-grid',
    name: 'Logo Grid',
    category: 'social-proof',
    type: 'logo-grid',
    icon: 'Grid',
    description: 'Client/partner logos display',
    defaultProps: {
      logos: [],
      columns: 4,
      grayscale: true,
    },
    configurable: ['logos', 'columns', 'grayscale'],
    shadcnComponents: [],
  },
]

// Analytics & Tracking Components
export const analyticsComponents: FunnelComponentDefinition[] = [
  {
    id: 'conversion-pixel',
    name: 'Conversion Pixel',
    category: 'analytics',
    type: 'pixel',
    icon: 'Target',
    description: 'Facebook/Google tracking pixel',
    defaultProps: {
      platform: 'facebook',
      pixelId: '',
      event: 'PageView',
    },
    configurable: ['platform', 'pixelId', 'event'],
    shadcnComponents: [],
  },
]

// Animation Components
export const animationComponents: FunnelComponentDefinition[] = [
  {
    id: 'animated-counter',
    name: 'Animated Counter',
    category: 'animation',
    type: 'counter',
    icon: 'Hash',
    description: 'Counting number animation',
    defaultProps: {
      endValue: 100,
      duration: 2000,
      prefix: '',
      suffix: '',
    },
    configurable: ['endValue', 'duration', 'prefix', 'suffix'],
    shadcnComponents: ['counting-number'],
  },
  {
    id: 'particles',
    name: 'Particle Effects',
    category: 'animation',
    type: 'particles',
    icon: 'Sparkles',
    description: 'Animated particle background',
    defaultProps: {
      type: 'particles',
      density: 50,
      color: '#ffffff',
    },
    configurable: ['type', 'density', 'color'],
    shadcnComponents: ['particles', 'sparkles', 'meteors'],
  },
  {
    id: 'background-animation',
    name: 'Background Animation',
    category: 'animation',
    type: 'bg-animation',
    icon: 'Waves',
    description: 'Animated background effects',
    defaultProps: {
      type: 'gradient',
      speed: 'medium',
      colors: ['#ff6b6b', '#4ecdc4'],
    },
    configurable: ['type', 'speed', 'colors'],
    shadcnComponents: ['background-gradient-animation', 'wavy-background', 'aurora-background'],
  },
]

// Business-Specific Components
export const businessComponents: FunnelComponentDefinition[] = [
  {
    id: 'appointment-booking',
    name: 'Appointment Booking',
    category: 'business',
    type: 'appointment',
    icon: 'Calendar',
    description: 'Calendar scheduling interface',
    defaultProps: {
      title: 'Book an Appointment',
      duration: 30,
      timezone: 'UTC',
    },
    configurable: ['title', 'duration', 'timezone'],
    shadcnComponents: ['calendar'],
  },
  {
    id: 'lead-magnet',
    name: 'Lead Magnet',
    category: 'business',
    type: 'lead-magnet',
    icon: 'Download',
    description: 'Content download gate',
    defaultProps: {
      title: 'Download Free Guide',
      description: 'Get our comprehensive guide delivered to your inbox',
      downloadLink: '',
    },
    configurable: ['title', 'description', 'downloadLink'],
    shadcnComponents: [],
  },
]

// Master component registry
export const allFunnelComponents: FunnelComponentDefinition[] = [
  ...contentComponents,
  ...formComponents,
  ...interactiveComponents,
  ...mediaComponents,
  ...ecommerceComponents,
  ...layoutComponents,
  ...navigationComponents,
  ...socialProofComponents,
  ...analyticsComponents,
  ...animationComponents,
  ...businessComponents,
]

// Helper functions
export const getComponentsByCategory = (category: FunnelComponentCategory): FunnelComponentDefinition[] => {
  return allFunnelComponents.filter(component => component.category === category)
}

export const getComponentById = (id: string): FunnelComponentDefinition | undefined => {
  return allFunnelComponents.find(component => component.id === id)
}

export const getComponentCategories = (): FunnelComponentCategory[] => {
  return [
    'content',
    'forms',
    'interactive',
    'media',
    'ecommerce',
    'layout',
    'navigation',
    'social-proof',
    'analytics',
    'animation',
    'business'
  ]
}

// Extended EditorBtns type to include all new component types
export type ExtendedEditorBtns = EditorBtns |
  'heading' | 'rich-text' | 'animated-text' | 'icon' | 'divider' | 'spacer' | 'code-block' |
  'snippet' | 'qr-code' | 'newsletter' | 'survey' | 'file-upload' | 'date-picker' | 'phone-input' |
  'button' | 'tabs' | 'accordion' | 'modal' | 'tooltip' | 'dropdown' | 'image-gallery' |
  'image-carousel' | 'audio-player' | 'product-card' | 'price-table' | 'rating' | 'card' |
  'navbar' | 'breadcrumbs' | 'pagination' | 'testimonial' | 'logo-grid' | 'pixel' | 'counter' |
  'particles' | 'bg-animation' | 'appointment' | 'lead-magnet'