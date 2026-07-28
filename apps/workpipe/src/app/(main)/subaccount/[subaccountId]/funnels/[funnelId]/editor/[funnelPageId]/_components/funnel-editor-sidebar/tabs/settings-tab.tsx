'use client'
import {
  AlignCenter,
  AlignHorizontalJustifyCenterIcon,
  AlignHorizontalJustifyEndIcon,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceAround,
  AlignHorizontalSpaceBetween,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  ChevronsLeftRightIcon,
  LucideImageDown,
  ExternalLink,
} from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ColorPicker } from '@/components/ui/color-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEditor } from '@/providers/editor/editor-provider'

type Props = Record<string, never>

const SettingsTab = (props: Props) => {
  const { state, dispatch } = useEditor()

  const handleOnChanges = (e: any) => {
    const styleSettings = e.target.id
    const value = e.target.value
    const styleObject = {
      [styleSettings]: value,
    }

    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        elementDetails: {
          ...state.editor.selectedElement,
          styles: {
            ...state.editor.selectedElement.styles,
            ...styleObject,
          },
        },
      },
    })
  }

  const handleChangeCustomValues = (e: any) => {
    const settingProperty = e.target.id
    const value = e.target.value
    const styleObject = {
      [settingProperty]: value,
    }

    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        elementDetails: {
          ...state.editor.selectedElement,
          content: {
            ...state.editor.selectedElement.content,
            ...styleObject,
          },
        },
      },
    })
  }

  return (
    <Accordion
      type="multiple"
      className="w-full"
      defaultValue={[
        'Custom',
        'Typography',
        'Dimensions',
        'Decorations',
        'Flexbox',
        'Effects',
      ]}
    >
      <AccordionItem value="Custom" className="px-6 py-0">
        <AccordionTrigger className="!no-underline">
          {state.editor.selectedElement.name || 'Element'} Settings
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4">
          {/* Link Settings */}
          {state.editor.selectedElement.type === 'link' &&
            !Array.isArray(state.editor.selectedElement.content) && (
              <div className="flex flex-col gap-2">
                <Label className="text-muted-foreground">Link URL</Label>
                <Input
                  id="href"
                  placeholder="https://example.com"
                  onChange={handleChangeCustomValues}
                  value={
                    (state.editor.selectedElement.content as any)?.href || ''
                  }
                />
              </div>
            )}

          {/* Button Settings */}
          {state.editor.selectedElement.type === 'button' &&
            !Array.isArray(state.editor.selectedElement.content) && (
              <>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Button Text</Label>
                  <Input
                    id="text"
                    placeholder="Click Me"
                    onChange={handleChangeCustomValues}
                    value={
                      (state.editor.selectedElement.content as any)?.text || ''
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Link URL</Label>
                  <Input
                    id="href"
                    placeholder="https://example.com"
                    onChange={handleChangeCustomValues}
                    value={
                      (state.editor.selectedElement.content as any)?.href || ''
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Variant</Label>
                  <Select
                    value={
                      (state.editor.selectedElement.content as any)?.variant ||
                      'primary'
                    }
                    onValueChange={value =>
                      handleChangeCustomValues({
                        target: { id: 'variant', value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select variant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                      <SelectItem value="outline">Outline</SelectItem>
                      <SelectItem value="ghost">Ghost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Size</Label>
                  <Select
                    value={
                      (state.editor.selectedElement.content as any)?.size ||
                      'md'
                    }
                    onValueChange={value =>
                      handleChangeCustomValues({
                        target: { id: 'size', value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Small</SelectItem>
                      <SelectItem value="md">Medium</SelectItem>
                      <SelectItem value="lg">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label className="text-muted-foreground">Background</Label>
                    <ColorPicker
                      onChange={value =>
                        handleChangeCustomValues({
                          target: { id: 'backgroundColor', value },
                        })
                      }
                      value={
                        (state.editor.selectedElement.content as any)
                          ?.backgroundColor || '#6366f1'
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-muted-foreground">Text Color</Label>
                    <ColorPicker
                      onChange={value =>
                        handleChangeCustomValues({
                          target: { id: 'textColor', value },
                        })
                      }
                      value={
                        (state.editor.selectedElement.content as any)
                          ?.textColor || '#ffffff'
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fullWidth"
                    checked={
                      (state.editor.selectedElement.content as any)
                        ?.fullWidth || false
                    }
                    onCheckedChange={checked =>
                      handleChangeCustomValues({
                        target: { id: 'fullWidth', value: checked },
                      })
                    }
                  />
                  <Label htmlFor="fullWidth" className="text-muted-foreground">
                    Full Width
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="newTab"
                    checked={
                      (state.editor.selectedElement.content as any)?.target ===
                      '_blank'
                    }
                    onCheckedChange={checked =>
                      handleChangeCustomValues({
                        target: {
                          id: 'target',
                          value: checked ? '_blank' : '_self',
                        },
                      })
                    }
                  />
                  <Label
                    htmlFor="newTab"
                    className="flex items-center gap-1 text-muted-foreground"
                  >
                    Open in new tab <ExternalLink size={12} />
                  </Label>
                </div>
              </>
            )}

          {/* Image Settings */}
          {state.editor.selectedElement.type === 'image' &&
            !Array.isArray(state.editor.selectedElement.content) && (
              <>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Image URL</Label>
                  <Input
                    id="src"
                    placeholder="https://example.com/image.jpg"
                    onChange={handleChangeCustomValues}
                    value={
                      (state.editor.selectedElement.content as any)?.src || ''
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Alt Text</Label>
                  <Input
                    id="alt"
                    placeholder="Image description"
                    onChange={handleChangeCustomValues}
                    value={
                      (state.editor.selectedElement.content as any)?.alt || ''
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">
                    Link URL (optional)
                  </Label>
                  <Input
                    id="href"
                    placeholder="https://example.com"
                    onChange={handleChangeCustomValues}
                    value={
                      (state.editor.selectedElement.content as any)?.href || ''
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Object Fit</Label>
                  <Select
                    value={
                      (state.editor.selectedElement.content as any)
                        ?.objectFit || 'cover'
                    }
                    onValueChange={value =>
                      handleChangeCustomValues({
                        target: { id: 'objectFit', value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cover">Cover</SelectItem>
                      <SelectItem value="contain">Contain</SelectItem>
                      <SelectItem value="fill">Fill</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

          {/* Icon Settings */}
          {state.editor.selectedElement.type === 'icon' &&
            !Array.isArray(state.editor.selectedElement.content) && (
              <>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Icon</Label>
                  <Select
                    value={
                      (state.editor.selectedElement.content as any)?.iconName ||
                      'star'
                    }
                    onValueChange={value =>
                      handleChangeCustomValues({
                        target: { id: 'iconName', value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select icon" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="star">Star</SelectItem>
                      <SelectItem value="heart">Heart</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="mail">Mail</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="settings">Settings</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="x">X</SelectItem>
                      <SelectItem value="arrow-right">Arrow Right</SelectItem>
                      <SelectItem value="arrow-left">Arrow Left</SelectItem>
                      <SelectItem value="search">Search</SelectItem>
                      <SelectItem value="shopping-cart">
                        Shopping Cart
                      </SelectItem>
                      <SelectItem value="download">Download</SelectItem>
                      <SelectItem value="play">Play</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Size (px)</Label>
                  <Slider
                    value={[
                      (state.editor.selectedElement.content as any)?.size || 24,
                    ]}
                    onValueChange={([value]) =>
                      handleChangeCustomValues({
                        target: { id: 'size', value },
                      })
                    }
                    min={12}
                    max={96}
                    step={4}
                  />
                  <small className="text-right text-muted-foreground">
                    {(state.editor.selectedElement.content as any)?.size || 24}
                    px
                  </small>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Color</Label>
                  <ColorPicker
                    onChange={value =>
                      handleChangeCustomValues({
                        target: { id: 'color', value },
                      })
                    }
                    value={
                      (state.editor.selectedElement.content as any)?.color ||
                      '#000000'
                    }
                  />
                </div>
              </>
            )}

          {/* Heading Settings */}
          {state.editor.selectedElement.type === 'heading' &&
            !Array.isArray(state.editor.selectedElement.content) && (
              <>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Heading Level</Label>
                  <Select
                    value={
                      (state.editor.selectedElement.content as any)?.level ||
                      'h2'
                    }
                    onValueChange={value =>
                      handleChangeCustomValues({
                        target: { id: 'level', value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="h1">H1 - Main Title</SelectItem>
                      <SelectItem value="h2">H2 - Section</SelectItem>
                      <SelectItem value="h3">H3 - Subsection</SelectItem>
                      <SelectItem value="h4">H4 - Sub-subsection</SelectItem>
                      <SelectItem value="h5">H5 - Minor</SelectItem>
                      <SelectItem value="h6">H6 - Smallest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Alignment</Label>
                  <Tabs
                    value={
                      (state.editor.selectedElement.content as any)
                        ?.alignment || 'left'
                    }
                    onValueChange={value =>
                      handleChangeCustomValues({
                        target: { id: 'alignment', value },
                      })
                    }
                  >
                    <TabsList className="flex h-fit flex-row items-center justify-between gap-4 rounded-md border-[1px] bg-transparent">
                      <TabsTrigger
                        value="left"
                        className="h-10 w-10 p-0 data-[state=active]:bg-muted"
                      >
                        <AlignLeft size={18} />
                      </TabsTrigger>
                      <TabsTrigger
                        value="center"
                        className="h-10 w-10 p-0 data-[state=active]:bg-muted"
                      >
                        <AlignCenter size={18} />
                      </TabsTrigger>
                      <TabsTrigger
                        value="right"
                        className="h-10 w-10 p-0 data-[state=active]:bg-muted"
                      >
                        <AlignRight size={18} />
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </>
            )}

          {/* Divider Settings */}
          {state.editor.selectedElement.type === 'divider' &&
            !Array.isArray(state.editor.selectedElement.content) && (
              <>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Style</Label>
                  <Select
                    value={
                      (state.editor.selectedElement.content as any)?.style ||
                      'solid'
                    }
                    onValueChange={value =>
                      handleChangeCustomValues({
                        target: { id: 'style', value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="dashed">Dashed</SelectItem>
                      <SelectItem value="dotted">Dotted</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">
                    Thickness (px)
                  </Label>
                  <Slider
                    value={[
                      (state.editor.selectedElement.content as any)
                        ?.thickness || 1,
                    ]}
                    onValueChange={([value]) =>
                      handleChangeCustomValues({
                        target: { id: 'thickness', value },
                      })
                    }
                    min={1}
                    max={10}
                    step={1}
                  />
                  <small className="text-right text-muted-foreground">
                    {(state.editor.selectedElement.content as any)?.thickness ||
                      1}
                    px
                  </small>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Color</Label>
                  <ColorPicker
                    onChange={value =>
                      handleChangeCustomValues({
                        target: { id: 'color', value },
                      })
                    }
                    value={
                      (state.editor.selectedElement.content as any)?.color ||
                      '#e5e5e5'
                    }
                  />
                </div>
              </>
            )}

          {/* Spacer Settings */}
          {state.editor.selectedElement.type === 'spacer' &&
            !Array.isArray(state.editor.selectedElement.content) && (
              <div className="flex flex-col gap-2">
                <Label className="text-muted-foreground">Height</Label>
                <Input
                  id="height"
                  placeholder="50px"
                  onChange={handleChangeCustomValues}
                  value={
                    (state.editor.selectedElement.content as any)?.height ||
                    '50px'
                  }
                />
              </div>
            )}

          {/* Video Settings */}
          {state.editor.selectedElement.type === 'video' &&
            !Array.isArray(state.editor.selectedElement.content) && (
              <div className="flex flex-col gap-2">
                <Label className="text-muted-foreground">
                  Video URL (YouTube Embed)
                </Label>
                <Input
                  id="src"
                  placeholder="https://www.youtube.com/embed/..."
                  onChange={handleChangeCustomValues}
                  value={
                    (state.editor.selectedElement.content as any)?.src || ''
                  }
                />
              </div>
            )}

          {/* No custom settings message */}
          {![
            'link',
            'button',
            'image',
            'icon',
            'heading',
            'divider',
            'spacer',
            'video',
          ].includes(state.editor.selectedElement.type ?? '') && (
            <p className="text-sm text-muted-foreground">
              No custom settings for this element. Use the style panels below.
            </p>
          )}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Typography" className="border-y-[1px] px-6 py-0">
        <AccordionTrigger className="!no-underline">
          Typography
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground">Text Align</p>
            <Tabs
              onValueChange={e =>
                handleOnChanges({
                  target: {
                    id: 'textAlign',
                    value: e,
                  },
                })
              }
              value={state.editor.selectedElement.styles.textAlign}
            >
              <TabsList className="flex h-fit flex-row items-center justify-between gap-4 rounded-md border-[1px] bg-transparent">
                <TabsTrigger
                  value="left"
                  className="h-10 w-10 p-0 data-[state=active]:bg-muted"
                >
                  <AlignLeft size={18} />
                </TabsTrigger>
                <TabsTrigger
                  value="right"
                  className="h-10 w-10 p-0 data-[state=active]:bg-muted"
                >
                  <AlignRight size={18} />
                </TabsTrigger>
                <TabsTrigger
                  value="center"
                  className="h-10 w-10 p-0 data-[state=active]:bg-muted"
                >
                  <AlignCenter size={18} />
                </TabsTrigger>
                <TabsTrigger
                  value="justify"
                  className="h-10 w-10 p-0 data-[state=active]:bg-muted"
                >
                  <AlignJustify size={18} />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground">Font Family</p>
            <Input
              id="DM Sans"
              onChange={handleOnChanges}
              value={state.editor.selectedElement.styles.fontFamily}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground">Color</p>
            <ColorPicker
              id="color"
              onChange={value =>
                handleOnChanges({
                  target: { id: 'color', value },
                })
              }
              value={state.editor.selectedElement.styles.color?.toString()}
              placeholder="#000000"
            />
          </div>
          <div className="flex gap-4">
            <div>
              <Label className="text-muted-foreground">Weight</Label>
              <Select
                onValueChange={e =>
                  handleOnChanges({
                    target: {
                      id: 'font-weight',
                      value: e,
                    },
                  })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a weight" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Font Weights</SelectLabel>
                    <SelectItem value="bold">Bold</SelectItem>
                    <SelectItem value="normal">Regular</SelectItem>
                    <SelectItem value="lighter">Light</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground">Size</Label>
              <Input
                placeholder="px"
                id="fontSize"
                onChange={handleOnChanges}
                value={state.editor.selectedElement.styles.fontSize}
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Dimensions" className="px-6 py-0">
        <AccordionTrigger className="!no-underline">
          Dimensions
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div>
                    <Label className="text-muted-foreground">Height</Label>
                    <Input
                      id="height"
                      placeholder="px"
                      onChange={handleOnChanges}
                      value={state.editor.selectedElement.styles.height}
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Width</Label>
                    <Input
                      placeholder="px"
                      id="width"
                      onChange={handleOnChanges}
                      value={state.editor.selectedElement.styles.width}
                    />
                  </div>
                </div>
              </div>
              <p>Margin px</p>
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div>
                    <Label className="text-muted-foreground">Top</Label>
                    <Input
                      id="marginTop"
                      placeholder="px"
                      onChange={handleOnChanges}
                      value={state.editor.selectedElement.styles.marginTop}
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Bottom</Label>
                    <Input
                      placeholder="px"
                      id="marginBottom"
                      onChange={handleOnChanges}
                      value={state.editor.selectedElement.styles.marginBottom}
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <Label className="text-muted-foreground">Left</Label>
                    <Input
                      placeholder="px"
                      id="marginLeft"
                      onChange={handleOnChanges}
                      value={state.editor.selectedElement.styles.marginLeft}
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Right</Label>
                    <Input
                      placeholder="px"
                      id="marginRight"
                      onChange={handleOnChanges}
                      value={state.editor.selectedElement.styles.marginRight}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p>Padding px</p>
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div>
                    <Label className="text-muted-foreground">Top</Label>
                    <Input
                      placeholder="px"
                      id="paddingTop"
                      onChange={handleOnChanges}
                      value={state.editor.selectedElement.styles.paddingTop}
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Bottom</Label>
                    <Input
                      placeholder="px"
                      id="paddingBottom"
                      onChange={handleOnChanges}
                      value={state.editor.selectedElement.styles.paddingBottom}
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <Label className="text-muted-foreground">Left</Label>
                    <Input
                      placeholder="px"
                      id="paddingLeft"
                      onChange={handleOnChanges}
                      value={state.editor.selectedElement.styles.paddingLeft}
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Right</Label>
                    <Input
                      placeholder="px"
                      id="paddingRight"
                      onChange={handleOnChanges}
                      value={state.editor.selectedElement.styles.paddingRight}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Decorations" className="px-6 py-0">
        <AccordionTrigger className="!no-underline">
          Decorations
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4">
          <div>
            <Label className="text-muted-foreground">Opacity</Label>
            <div className="flex items-center justify-end">
              <small className="p-2">
                {typeof state.editor.selectedElement.styles?.opacity ===
                'number'
                  ? state.editor.selectedElement.styles?.opacity
                  : parseFloat(
                      (
                        state.editor.selectedElement.styles?.opacity || '0'
                      ).replace('%', '')
                    ) || 0}
                %
              </small>
            </div>
            <Slider
              onValueChange={e => {
                handleOnChanges({
                  target: {
                    id: 'opacity',
                    value: `${e[0]}%`,
                  },
                })
              }}
              defaultValue={[
                typeof state.editor.selectedElement.styles?.opacity === 'number'
                  ? state.editor.selectedElement.styles?.opacity
                  : parseFloat(
                      (
                        state.editor.selectedElement.styles?.opacity || '0'
                      ).replace('%', '')
                    ) || 0,
              ]}
              max={100}
              step={1}
            />
          </div>
          <div>
            <Label className="text-muted-foreground">Border Radius</Label>
            <div className="flex items-center justify-end">
              <small className="">
                {typeof state.editor.selectedElement.styles?.borderRadius ===
                'number'
                  ? state.editor.selectedElement.styles?.borderRadius
                  : parseFloat(
                      (
                        state.editor.selectedElement.styles?.borderRadius || '0'
                      ).replace('px', '')
                    ) || 0}
                px
              </small>
            </div>
            <Slider
              onValueChange={e => {
                handleOnChanges({
                  target: {
                    id: 'borderRadius',
                    value: `${e[0]}px`,
                  },
                })
              }}
              defaultValue={[
                typeof state.editor.selectedElement.styles?.borderRadius ===
                'number'
                  ? state.editor.selectedElement.styles?.borderRadius
                  : parseFloat(
                      (
                        state.editor.selectedElement.styles?.borderRadius || '0'
                      ).replace('%', '')
                    ) || 0,
              ]}
              max={100}
              step={1}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Background Color</Label>
            <ColorPicker
              id="backgroundColor"
              onChange={value =>
                handleOnChanges({
                  target: { id: 'backgroundColor', value },
                })
              }
              value={state.editor.selectedElement.styles.backgroundColor?.toString()}
              placeholder="#ffffff"
            />
          </div>

          {/* Border Controls */}
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Border Style</Label>
            <Select
              value={
                state.editor.selectedElement.styles.borderStyle?.toString() ||
                'none'
              }
              onValueChange={value =>
                handleOnChanges({
                  target: { id: 'borderStyle', value },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="dashed">Dashed</SelectItem>
                <SelectItem value="dotted">Dotted</SelectItem>
                <SelectItem value="double">Double</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-muted-foreground">Border Width</Label>
              <Input
                id="borderWidth"
                placeholder="1px"
                onChange={handleOnChanges}
                value={
                  state.editor.selectedElement.styles.borderWidth?.toString() ||
                  ''
                }
              />
            </div>
            <div className="flex-1">
              <Label className="text-muted-foreground">Border Color</Label>
              <ColorPicker
                onChange={value =>
                  handleOnChanges({
                    target: { id: 'borderColor', value },
                  })
                }
                value={
                  state.editor.selectedElement.styles.borderColor?.toString() ||
                  '#000000'
                }
              />
            </div>
          </div>

          {/* Box Shadow Controls */}
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Box Shadow</Label>
            <Select
              value={
                state.editor.selectedElement.styles.boxShadow
                  ? 'custom'
                  : 'none'
              }
              onValueChange={value => {
                const shadowPresets: Record<string, string> = {
                  none: 'none',
                  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
                  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
                }
                handleOnChanges({
                  target: {
                    id: 'boxShadow',
                    value: shadowPresets[value] || 'none',
                  },
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select shadow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
                <SelectItem value="xl">Extra Large</SelectItem>
                <SelectItem value="2xl">2X Large</SelectItem>
                <SelectItem value="inner">Inner Shadow</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Custom Shadow</Label>
            <Input
              id="boxShadow"
              placeholder="0 4px 6px rgba(0,0,0,0.1)"
              onChange={handleOnChanges}
              value={
                state.editor.selectedElement.styles.boxShadow?.toString() || ''
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Background Image</Label>
            <div className="flex overflow-clip rounded-md border-[1px]">
              <div
                className="w-12"
                style={{
                  backgroundImage:
                    state.editor.selectedElement.styles.backgroundImage,
                }}
              />
              <Input
                placeholder="url()"
                className="mr-2 rounded-none !border-y-0 !border-r-0"
                id="backgroundImage"
                onChange={handleOnChanges}
                value={state.editor.selectedElement.styles.backgroundImage}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Image Position</Label>
            <Tabs
              onValueChange={e =>
                handleOnChanges({
                  target: {
                    id: 'backgroundSize',
                    value: e,
                  },
                })
              }
              value={state.editor.selectedElement.styles.backgroundSize?.toString()}
            >
              <TabsList className="flex h-fit flex-row items-center justify-between gap-4 rounded-md border-[1px] bg-transparent">
                <TabsTrigger
                  value="cover"
                  className="h-10 w-10 p-0 data-[state=active]:bg-muted"
                >
                  <ChevronsLeftRightIcon size={18} />
                </TabsTrigger>
                <TabsTrigger
                  value="contain"
                  className="h-10 w-10 p-0 data-[state=active]:bg-muted"
                >
                  <AlignVerticalJustifyCenter size={22} />
                </TabsTrigger>
                <TabsTrigger
                  value="auto"
                  className="h-10 w-10 p-0 data-[state=active]:bg-muted"
                >
                  <LucideImageDown size={18} />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Flexbox" className="px-6 py-0">
        <AccordionTrigger className="!no-underline">Flexbox</AccordionTrigger>
        <AccordionContent>
          <Label className="text-muted-foreground">Justify Content</Label>
          <Tabs
            onValueChange={e =>
              handleOnChanges({
                target: {
                  id: 'justifyContent',
                  value: e,
                },
              })
            }
            value={state.editor.selectedElement.styles.justifyContent}
          >
            <TabsList className="flex h-fit flex-row items-center justify-between gap-4 rounded-md border-[1px] bg-transparent">
              <TabsTrigger
                value="space-between"
                className="h-10 w-10 p-0 data-[state=active]:bg-muted"
              >
                <AlignHorizontalSpaceBetween size={18} />
              </TabsTrigger>
              <TabsTrigger
                value="space-evenly"
                className="h-10 w-10 p-0 data-[state=active]:bg-muted"
              >
                <AlignHorizontalSpaceAround size={18} />
              </TabsTrigger>
              <TabsTrigger
                value="center"
                className="h-10 w-10 p-0 data-[state=active]:bg-muted"
              >
                <AlignHorizontalJustifyCenterIcon size={18} />
              </TabsTrigger>
              <TabsTrigger
                value="start"
                className="h-10 w-10 p-0 data-[state=active]:bg-muted"
              >
                <AlignHorizontalJustifyStart size={18} />
              </TabsTrigger>
              <TabsTrigger
                value="end"
                className="h-10 w-10 p-0 data-[state=active]:bg-muted"
              >
                <AlignHorizontalJustifyEndIcon size={18} />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Label className="text-muted-foreground">Align Items</Label>
          <Tabs
            onValueChange={e =>
              handleOnChanges({
                target: {
                  id: 'alignItems',
                  value: e,
                },
              })
            }
            value={state.editor.selectedElement.styles.alignItems}
          >
            <TabsList className="flex h-fit flex-row items-center justify-between gap-4 rounded-md border-[1px] bg-transparent">
              <TabsTrigger
                value="center"
                className="h-10 w-10 p-0 data-[state=active]:bg-muted"
              >
                <AlignVerticalJustifyCenter size={18} />
              </TabsTrigger>
              <TabsTrigger
                value="normal"
                className="h-10 w-10 p-0 data-[state=active]:bg-muted"
              >
                <AlignVerticalJustifyStart size={18} />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Input
              className="h-4 w-4"
              placeholder="px"
              type="checkbox"
              id="display"
              onChange={va => {
                handleOnChanges({
                  target: {
                    id: 'display',
                    value: va.target.checked ? 'flex' : 'block',
                  },
                })
              }}
            />
            <Label className="text-muted-foreground">Flex</Label>
          </div>
          <div>
            <Label className="text-muted-foreground"> Direction</Label>
            <Input
              placeholder="px"
              id="flexDirection"
              onChange={handleOnChanges}
              value={state.editor.selectedElement.styles.flexDirection}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Effects" className="px-6 py-0">
        <AccordionTrigger className="!no-underline">Effects</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4">
          {/* Transform Controls */}
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Scale</Label>
            <Slider
              value={[
                parseFloat(
                  state.editor.selectedElement.styles.transform
                    ?.toString()
                    .match(/scale\(([^)]+)\)/)?.[1] || '1'
                ) * 100,
              ]}
              onValueChange={([value]) => {
                const currentTransform =
                  state.editor.selectedElement.styles.transform?.toString() ||
                  ''
                const newScale = `scale(${value / 100})`
                const newTransform = currentTransform.includes('scale')
                  ? currentTransform.replace(/scale\([^)]+\)/, newScale)
                  : `${currentTransform} ${newScale}`.trim()
                handleOnChanges({
                  target: { id: 'transform', value: newTransform },
                })
              }}
              min={50}
              max={200}
              step={5}
            />
            <small className="text-right text-muted-foreground">
              {parseFloat(
                state.editor.selectedElement.styles.transform
                  ?.toString()
                  .match(/scale\(([^)]+)\)/)?.[1] || '1'
              ) * 100}
              %
            </small>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Rotate (deg)</Label>
            <Slider
              value={[
                parseFloat(
                  state.editor.selectedElement.styles.transform
                    ?.toString()
                    .match(/rotate\(([^)]+)deg\)/)?.[1] || '0'
                ),
              ]}
              onValueChange={([value]) => {
                const currentTransform =
                  state.editor.selectedElement.styles.transform?.toString() ||
                  ''
                const newRotate = `rotate(${value}deg)`
                const newTransform = currentTransform.includes('rotate')
                  ? currentTransform.replace(/rotate\([^)]+\)/, newRotate)
                  : `${currentTransform} ${newRotate}`.trim()
                handleOnChanges({
                  target: { id: 'transform', value: newTransform },
                })
              }}
              min={-180}
              max={180}
              step={5}
            />
            <small className="text-right text-muted-foreground">
              {parseFloat(
                state.editor.selectedElement.styles.transform
                  ?.toString()
                  .match(/rotate\(([^)]+)deg\)/)?.[1] || '0'
              )}
              °
            </small>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-muted-foreground">Translate X</Label>
              <Input
                placeholder="0px"
                onChange={e => {
                  const currentTransform =
                    state.editor.selectedElement.styles.transform?.toString() ||
                    ''
                  const currentY =
                    currentTransform.match(/translateY\(([^)]+)\)/)?.[1] ||
                    '0px'
                  const newTranslate = `translateX(${e.target.value}) translateY(${currentY})`
                  const newTransform = currentTransform
                    .replace(/translateX\([^)]+\)/, '')
                    .replace(/translateY\([^)]+\)/, '')
                  handleOnChanges({
                    target: {
                      id: 'transform',
                      value: `${newTransform} ${newTranslate}`.trim(),
                    },
                  })
                }}
                value={
                  state.editor.selectedElement.styles.transform
                    ?.toString()
                    .match(/translateX\(([^)]+)\)/)?.[1] || ''
                }
              />
            </div>
            <div className="flex-1">
              <Label className="text-muted-foreground">Translate Y</Label>
              <Input
                placeholder="0px"
                onChange={e => {
                  const currentTransform =
                    state.editor.selectedElement.styles.transform?.toString() ||
                    ''
                  const currentX =
                    currentTransform.match(/translateX\(([^)]+)\)/)?.[1] ||
                    '0px'
                  const newTranslate = `translateX(${currentX}) translateY(${e.target.value})`
                  const newTransform = currentTransform
                    .replace(/translateX\([^)]+\)/, '')
                    .replace(/translateY\([^)]+\)/, '')
                  handleOnChanges({
                    target: {
                      id: 'transform',
                      value: `${newTransform} ${newTranslate}`.trim(),
                    },
                  })
                }}
                value={
                  state.editor.selectedElement.styles.transform
                    ?.toString()
                    .match(/translateY\(([^)]+)\)/)?.[1] || ''
                }
              />
            </div>
          </div>

          {/* Transition Controls */}
          <div className="flex flex-col gap-2 border-t pt-4">
            <Label className="text-muted-foreground">Transition</Label>
            <Select
              value={
                state.editor.selectedElement.styles.transition
                  ? 'custom'
                  : 'none'
              }
              onValueChange={value => {
                const transitionPresets: Record<string, string> = {
                  none: 'none',
                  fast: 'all 0.15s ease',
                  normal: 'all 0.3s ease',
                  slow: 'all 0.5s ease',
                  bounce: 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                }
                handleOnChanges({
                  target: {
                    id: 'transition',
                    value: transitionPresets[value] || 'none',
                  },
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select transition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="fast">Fast (0.15s)</SelectItem>
                <SelectItem value="normal">Normal (0.3s)</SelectItem>
                <SelectItem value="slow">Slow (0.5s)</SelectItem>
                <SelectItem value="bounce">Bounce</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Custom Transition</Label>
            <Input
              id="transition"
              placeholder="all 0.3s ease"
              onChange={handleOnChanges}
              value={
                state.editor.selectedElement.styles.transition?.toString() || ''
              }
            />
          </div>

          {/* Cursor */}
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Cursor</Label>
            <Select
              value={
                state.editor.selectedElement.styles.cursor?.toString() || 'auto'
              }
              onValueChange={value =>
                handleOnChanges({
                  target: { id: 'cursor', value },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cursor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="pointer">Pointer</SelectItem>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="move">Move</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="not-allowed">Not Allowed</SelectItem>
                <SelectItem value="grab">Grab</SelectItem>
                <SelectItem value="crosshair">Crosshair</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export default SettingsTab
