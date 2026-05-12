'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface ColorPickerProps {
  id?: string
  value?: string
  onChange?: (value: string) => void
  className?: string
  disabled?: boolean
  placeholder?: string
}

const ColorPicker = React.forwardRef<HTMLInputElement, ColorPickerProps>(
  ({ id, value = '', onChange, className, disabled, placeholder = '#000000' }, ref) => {
    const colorInputRef = React.useRef<HTMLInputElement>(null)

    // Normalize color value for the color input (must be valid hex)
    const normalizedColorValue = React.useMemo(() => {
      if (!value) return '#000000'
      // If it's already a valid hex color
      if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value
      // If it's a 3-digit hex, expand it
      if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
        const r = value[1]
        const g = value[2]
        const b = value[3]
        return `#${r}${r}${g}${g}${b}${b}`
      }
      // Try to handle common color names or return default
      return '#000000'
    }, [value])

    const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.value)
    }

    const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.value)
    }

    const handleSwatchClick = () => {
      colorInputRef.current?.click()
    }

    return (
      <div className={cn('flex overflow-clip rounded-md border-[1px]', className)}>
        {/* Color swatch / picker trigger */}
        <button
          type="button"
          onClick={handleSwatchClick}
          disabled={disabled}
          className="flex h-10 w-12 shrink-0 cursor-pointer items-center justify-center border-r bg-muted/50 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: value || '#ffffff' }}
          title="Click to open color picker"
        >
          {/* Hidden native color input */}
          <input
            ref={colorInputRef}
            type="color"
            value={normalizedColorValue}
            onChange={handleColorInputChange}
            disabled={disabled}
            className="sr-only"
            tabIndex={-1}
          />
        </button>

        {/* Text input for manual entry */}
        <input
          ref={ref}
          type="text"
          id={id}
          value={value || ''}
          onChange={handleTextInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex h-10 w-full bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    )
  }
)

ColorPicker.displayName = 'ColorPicker'

export { ColorPicker }
