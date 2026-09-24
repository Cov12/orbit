'use client'

import React, { useState } from 'react'

import clsx from 'clsx'
import { Plus, Trash2 } from 'lucide-react'

import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

interface TabItem {
  id: string
  label: string
  content: string
}

interface TabsContent {
  tabs: TabItem[]
  activeTab: string
  variant: 'default' | 'pills' | 'underline'
  tabPosition: 'top' | 'bottom'
  tabAlignment: 'start' | 'center' | 'end' | 'stretch'
  backgroundColor: string
  activeColor: string
  textColor: string
  activeTextColor: string
}

interface TabsComponentProps {
  element: EditorElement
}

const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

const TabsComponent: React.FC<TabsComponentProps> = ({ element }) => {
  const { dispatch, state } = useEditor()
  const content = element.content as TabsContent

  const tabs = content?.tabs || [
    { id: generateTabId(), label: 'Tab 1', content: 'Content for Tab 1' },
    { id: generateTabId(), label: 'Tab 2', content: 'Content for Tab 2' },
    { id: generateTabId(), label: 'Tab 3', content: 'Content for Tab 3' },
  ]

  const [activeTabId, setActiveTabId] = useState(content?.activeTab || tabs[0]?.id)
  const variant = content?.variant || 'default'
  const tabPosition = content?.tabPosition || 'top'
  const tabAlignment = content?.tabAlignment || 'start'

  const updateContent = (newContent: Partial<TabsContent>) => {
    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        elementDetails: {
          ...element,
          content: {
            ...content,
            ...newContent,
          } as any,
        },
      },
    })
  }

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId)
    updateContent({ activeTab: tabId })
  }

  const handleTabLabelChange = (tabId: string, newLabel: string) => {
    const updatedTabs = tabs.map(tab =>
      tab.id === tabId ? { ...tab, label: newLabel } : tab
    )
    updateContent({ tabs: updatedTabs })
  }

  const handleTabContentChange = (tabId: string, newContent: string) => {
    const updatedTabs = tabs.map(tab =>
      tab.id === tabId ? { ...tab, content: newContent } : tab
    )
    updateContent({ tabs: updatedTabs })
  }

  const addTab = () => {
    const newTab: TabItem = {
      id: generateTabId(),
      label: `Tab ${tabs.length + 1}`,
      content: `Content for Tab ${tabs.length + 1}`,
    }
    updateContent({ tabs: [...tabs, newTab] })
  }

  const removeTab = (tabId: string) => {
    if (tabs.length <= 1) return
    const updatedTabs = tabs.filter(tab => tab.id !== tabId)
    updateContent({ tabs: updatedTabs })
    if (activeTabId === tabId) {
      setActiveTabId(updatedTabs[0]?.id)
    }
  }

  const getTabStyles = (isActive: boolean): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      padding: '10px 20px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: 'none',
      background: 'transparent',
      fontSize: '14px',
      fontWeight: isActive ? 600 : 400,
    }

    switch (variant) {
      case 'pills':
        return {
          ...baseStyles,
          borderRadius: '9999px',
          backgroundColor: isActive ? (content?.activeColor || '#6366f1') : (content?.backgroundColor || 'transparent'),
          color: isActive ? (content?.activeTextColor || '#ffffff') : (content?.textColor || '#64748b'),
        }
      case 'underline':
        return {
          ...baseStyles,
          borderBottom: isActive ? `2px solid ${content?.activeColor || '#6366f1'}` : '2px solid transparent',
          color: isActive ? (content?.activeColor || '#6366f1') : (content?.textColor || '#64748b'),
          marginBottom: '-2px',
        }
      default:
        return {
          ...baseStyles,
          backgroundColor: isActive ? (content?.activeColor || '#ffffff') : (content?.backgroundColor || '#f1f5f9'),
          color: isActive ? (content?.activeTextColor || '#1e293b') : (content?.textColor || '#64748b'),
          borderRadius: '8px 8px 0 0',
          borderBottom: isActive ? 'none' : '1px solid #e2e8f0',
        }
    }
  }

  const tabListStyles: React.CSSProperties = {
    display: 'flex',
    gap: '4px',
    justifyContent: tabAlignment === 'stretch' ? 'stretch' :
                    tabAlignment === 'center' ? 'center' :
                    tabAlignment === 'end' ? 'flex-end' : 'flex-start',
    borderBottom: variant === 'underline' ? '2px solid #e2e8f0' : 'none',
    flexWrap: 'wrap',
  }

  const contentStyles: React.CSSProperties = {
    padding: '20px',
    backgroundColor: '#ffffff',
    border: variant === 'default' ? '1px solid #e2e8f0' : 'none',
    borderTop: variant === 'default' ? 'none' : undefined,
    borderRadius: variant === 'default' ? '0 0 8px 8px' : '8px',
    minHeight: '100px',
  }

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0]
  const isLiveMode = state.editor.liveMode

  const TabList = (
    <div style={tabListStyles}>
      {tabs.map(tab => (
        <div key={tab.id} className="relative group">
          <button
            style={{
              ...getTabStyles(tab.id === activeTabId),
              flex: tabAlignment === 'stretch' ? 1 : undefined,
            }}
            onClick={() => handleTabClick(tab.id)}
          >
            {isLiveMode ? (
              tab.label
            ) : (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleTabLabelChange(tab.id, e.currentTarget.innerText)}
                className="outline-none"
              >
                {tab.label}
              </span>
            )}
          </button>
          {!isLiveMode && tabs.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                removeTab(tab.id)
              }}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              title="Remove tab"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ))}
      {!isLiveMode && (
        <button
          onClick={addTab}
          className="px-3 py-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors flex items-center gap-1"
          title="Add tab"
        >
          <Plus size={16} />
        </button>
      )}
    </div>
  )

  const TabContent = (
    <div style={contentStyles}>
      {isLiveMode ? (
        <p>{activeTab?.content}</p>
      ) : (
        <p
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => handleTabContentChange(activeTabId, e.currentTarget.innerText)}
          className="outline-none min-h-[60px]"
        >
          {activeTab?.content}
        </p>
      )}
    </div>
  )

  return (
    <BaseFunnelComponent element={element} className="w-full">
      <div className="w-full">
        {tabPosition === 'top' ? (
          <>
            {TabList}
            {TabContent}
          </>
        ) : (
          <>
            {TabContent}
            {TabList}
          </>
        )}
      </div>
    </BaseFunnelComponent>
  )
}

export default TabsComponent
