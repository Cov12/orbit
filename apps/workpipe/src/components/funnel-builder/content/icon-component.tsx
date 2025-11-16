'use client'

import React from 'react'

import {
  Star,
  Heart,
  User,
  Home,
  Mail,
  Phone,
  Settings,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Search,
  ShoppingCart,
  Download,
  Upload,
  Play,
  Pause,
  Square
} from 'lucide-react'

import { EditorElement } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

interface IconContent {
  iconName: string
  size: number
  color: string
}

interface IconComponentProps {
  element: EditorElement
}

// Icon mapping for common icons
const iconMap = {
  star: Star,
  heart: Heart,
  user: User,
  home: Home,
  mail: Mail,
  phone: Phone,
  settings: Settings,
  check: Check,
  x: X,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  search: Search,
  'shopping-cart': ShoppingCart,
  download: Download,
  upload: Upload,
  play: Play,
  pause: Pause,
  stop: Square,
}

const IconComponent: React.FC<IconComponentProps> = ({ element }) => {
  const content = element.content as IconContent

  const iconName = content?.iconName || 'star'
  const size = content?.size || 24
  const color = content?.color || '#000000'

  const IconElement = iconMap[iconName as keyof typeof iconMap] || Star

  const iconStyles = {
    padding: '10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <BaseFunnelComponent element={element} className="w-fit">
      <div style={iconStyles}>
        <IconElement
          size={size}
          color={color}
          className="shrink-0"
        />
      </div>
    </BaseFunnelComponent>
  )
}

export default IconComponent