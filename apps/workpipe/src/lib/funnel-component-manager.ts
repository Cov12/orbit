/**
 * Funnel Component Manager
 * Provides utilities for managing funnel builder components
 * Integrates with shadcn MCP for UI component selection
 */

import { EditorBtns } from '@/lib/constants'
import { EditorElement } from '@/providers/editor/editor-provider'

import {
  allFunnelComponents,
  getComponentsByCategory,
  getComponentById,
  getComponentCategories,
  type FunnelComponentDefinition,
  type FunnelComponentCategory,
} from './funnel-components'

export class FunnelComponentManager {
  /**
   * Create a new editor element from a component definition
   */
  static createElement(
    componentDef: FunnelComponentDefinition,
    _containerId: string
  ): EditorElement {
    const id = `${componentDef.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      id,
      name: componentDef.name,
      type: componentDef.type as EditorBtns,
      styles: {
        margin: '5px',
        padding: '10px',
        ...componentDef.defaultProps.styles,
      },
      content: componentDef.defaultProps,
    }
  }

  /**
   * Get all available component categories
   */
  static getCategories(): FunnelComponentCategory[] {
    return getComponentCategories()
  }

  /**
   * Get components by category
   */
  static getComponentsByCategory(category: FunnelComponentCategory): FunnelComponentDefinition[] {
    return getComponentsByCategory(category)
  }

  /**
   * Get all available components
   */
  static getAllComponents(): FunnelComponentDefinition[] {
    return allFunnelComponents
  }

  /**
   * Get component definition by ID
   */
  static getComponentDefinition(id: string): FunnelComponentDefinition | undefined {
    return getComponentById(id)
  }

  /**
   * Get component definition by type
   */
  static getComponentDefinitionByType(type: EditorBtns): FunnelComponentDefinition | undefined {
    return allFunnelComponents.find(comp => comp.type === type)
  }

  /**
   * Validate if a component type is supported
   */
  static isValidComponentType(type: string): boolean {
    return allFunnelComponents.some(comp => comp.type === type)
  }

  /**
   * Get shadcn components for a specific funnel component
   */
  static getShadcnComponents(componentId: string): string[] {
    const component = getComponentById(componentId)
    return component?.shadcnComponents || []
  }

  /**
   * Get configurable properties for a component
   */
  static getConfigurableProperties(componentId: string): string[] {
    const component = getComponentById(componentId)
    return component?.configurable || []
  }

  /**
   * Generate component palette for editor sidebar
   */
  static generateComponentPalette() {
    const categories = this.getCategories()

    return categories.map(category => ({
      category,
      label: this.formatCategoryLabel(category),
      components: this.getComponentsByCategory(category).map(comp => ({
        id: comp.id,
        name: comp.name,
        type: comp.type,
        icon: comp.icon,
        description: comp.description,
      }))
    }))
  }

  /**
   * Format category label for display
   */
  private static formatCategoryLabel(category: FunnelComponentCategory): string {
    const labels: Record<FunnelComponentCategory, string> = {
      'content': 'Content',
      'forms': 'Forms',
      'interactive': 'Interactive',
      'media': 'Media',
      'ecommerce': 'E-commerce',
      'layout': 'Layout',
      'navigation': 'Navigation',
      'social-proof': 'Social Proof',
      'analytics': 'Analytics',
      'animation': 'Animation',
      'business': 'Business',
    }

    return labels[category] || category
  }

  /**
   * Search components by keyword
   */
  static searchComponents(query: string): FunnelComponentDefinition[] {
    const searchTerm = query.toLowerCase().trim()

    if (!searchTerm) {
      return this.getAllComponents()
    }

    return allFunnelComponents.filter(component =>
      component.name.toLowerCase().includes(searchTerm) ||
      component.description.toLowerCase().includes(searchTerm) ||
      component.category.toLowerCase().includes(searchTerm) ||
      (component.shadcnComponents && component.shadcnComponents.some(sc =>
        sc.toLowerCase().includes(searchTerm)
      ))
    )
  }

  /**
   * Get default props for a component type
   */
  static getDefaultProps(type: EditorBtns): Record<string, any> {
    const component = this.getComponentDefinitionByType(type)
    return component?.defaultProps || {}
  }

  /**
   * Validate component configuration
   */
  static validateComponentConfig(
    componentId: string,
    config: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const component = getComponentById(componentId)

    if (!component) {
      return { valid: false, errors: ['Component not found'] }
    }

    const errors: string[] = []
    const configurableProps = component.configurable

    // Check for required configurableproperties
    configurableProps.forEach(prop => {
      if (!(prop in config)) {
        errors.push(`Missing required property: ${prop}`)
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get component dependencies (shadcn components)
   */
  static getComponentDependencies(componentId: string): {
    shadcn: string[]
    npm?: string[]
  } {
    const component = getComponentById(componentId)

    return {
      shadcn: component?.shadcnComponents || [],
      npm: [] // Can be extended with npm dependencies if needed
    }
  }

  /**
   * Clone an element with new ID
   */
  static cloneElement(element: EditorElement): EditorElement {
    const newId = `${element.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      ...element,
      id: newId,
      name: `${element.name} (Copy)`,
      content: Array.isArray(element.content)
        ? element.content.map(child => this.cloneElement(child))
        : { ...element.content }
    }
  }

  /**
   * Update element configuration
   */
  static updateElementConfig(
    element: EditorElement,
    config: Record<string, any>
  ): EditorElement {
    return {
      ...element,
      content: Array.isArray(element.content)
        ? element.content
        : { ...element.content, ...config }
    }
  }
}

export default FunnelComponentManager