import React, { useState } from 'react'
import Editor from '@monaco-editor/react'
import { MessageEntry, AttachedImage, AgentInfo, Mode, KodaTheme, KodaSettings, TrackedFile } from '../types/index.js'
import { FileExplorer } from './context/ContextPanel.js'
import { getIconForFile } from 'vscode-icons-js'
import BrowserPreview from './BrowserPreview.js'
import TerminalPanel from './TerminalPanel.js'

interface IDELayoutProps {
  // Explorer props
  showExplorerPanel: boolean
  cwd: string
  pinnedFiles: string[]
  onPin: (path: string) => void
  onInject: (path: string) => void
  onAddToInput: (path: string) => void
  
  // Editor props
  showEditorPanel: boolean
  
  // Browser/Terminal props
  showBrowser?: boolean
  showTerminal?: boolean
  onBrowserClose?: () => void
  onTerminalClose?: () => void
  
  // Chat props (será o conteúdo principal quando não há editor)
  children: React.ReactNode
}

interface OpenFile {
  path: string
  content: string
  hasUnsavedChanges: boolean
}

type TabType = 'file' | 'browser' | 'terminal'

interface Tab {
  id: string
  type: TabType
  title: string
  icon?: string
  file?: OpenFile
}

const IDELayout: React.FC<IDELayoutProps> = ({
  showExplorerPanel,
  cwd,
  pinnedFiles,
  onPin,
  onInject,
  onAddToInput,
  showEditorPanel,
  showBrowser = false,
  showTerminal = false,
  onBrowserClose,
  onTerminalClose,
  children
}) => {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [terminalHeight, setTerminalHeight] = useState(30) // Porcentagem
  
  const activeTab = tabs.find(t => t.id === activeTabId)

  // Adicionar tab do navegador quando showBrowser mudar
  React.useEffect(() => {
    if (showBrowser && showEditorPanel) {
      const browserTab: Tab = {
        id: '__browser__',
        type: 'browser',
        title: 'Browser',
        icon: 'default_folder.svg'
      }
      
      setTabs(prev => {
        const hasBrowser = prev.some(t => t.id === '__browser__')
        if (!hasBrowser) {
          return [...prev, browserTab]
        }
        return prev
      })
      setActiveTabId('__browser__')
    } else if (!showBrowser) {
      setTabs(prev => prev.filter(t => t.id !== '__browser__'))
      if (activeTabId === '__browser__') {
        const remaining = tabs.filter(t => t.id !== '__browser__')
        setActiveTabId(remaining.length > 0 ? remaining[0].id : null)
      }
    }
  }, [showBrowser, showEditorPanel])

  const loadFileContent = async (filePath: string) => {
    // Verificar se o arquivo já está aberto
    const existingTab = tabs.find(t => t.type === 'file' && t.file?.path === filePath)
    if (existingTab) {
      setActiveTabId(existingTab.id)
      return
    }

    setIsLoadingFile(true)
    try {
      const result = await window.koda.readFile(filePath)
      if (result.success) {
        const newFile: OpenFile = {
          path: filePath,
          content: result.content,
          hasUnsavedChanges: false
        }
        const fileName = filePath.split('/').pop() || filePath
        const newTab: Tab = {
          id: `file-${Date.now()}`,
          type: 'file',
          title: fileName,
          icon: getIconForFile(fileName),
          file: newFile
        }
        setTabs(prev => [...prev, newTab])
        setActiveTabId(newTab.id)
      }
    } catch (error) {
      console.error('Error loading file:', error)
    } finally {
      setIsLoadingFile(false)
    }
  }

  const saveFileContent = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId && t.type === 'file')
    if (!tab || !tab.file) return
    
    try {
      await window.koda.writeFile(tab.file.path, tab.file.content)
      setTabs(prev => prev.map(t => 
        t.id === tabId && t.file
          ? { ...t, file: { ...t.file, hasUnsavedChanges: false } }
          : t
      ))
    } catch (error) {
      console.error('Error saving file:', error)
    }
  }

  const handleFileContentChange = (tabId: string, newContent: string) => {
    setTabs(prev => prev.map(t => 
      t.id === tabId && t.file
        ? { ...t, file: { ...t.file, content: newContent, hasUnsavedChanges: true } }
        : t
    ))
  }

  const closeTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    
    // Se for browser ou terminal, chamar o callback apropriado
    if (tab?.type === 'browser' && onBrowserClose) {
      onBrowserClose()
      return
    }
    
    setTabs(prev => prev.filter(t => t.id !== tabId))
    if (activeTabId === tabId) {
      const remainingTabs = tabs.filter(t => t.id !== tabId)
      setActiveTabId(remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].id : null)
    }
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+W to close active tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w' && activeTabId) {
        e.preventDefault()
        closeTab(activeTabId)
      }
      // Ctrl+S to save active file
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && activeTab?.type === 'file' && activeTab.file?.hasUnsavedChanges) {
        e.preventDefault()
        saveFileContent(activeTabId!)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabId, activeTab, tabs])

  const getLanguageFromFilename = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'toml': 'toml',
      'ini': 'ini',
      'dockerfile': 'dockerfile',
      'vue': 'vue',
      'svelte': 'svelte',
    }
    return languageMap[ext || ''] || 'plaintext'
  }

  const handleFileClick = (filePath: string) => {
    if (showEditorPanel) {
      loadFileContent(filePath)
    } else {
      onInject(filePath)
    }
  }

  return (
    <div className="flex h-full">
      {/* Explorer Panel */}
      {showExplorerPanel && (
        <div className="w-64 flex-shrink-0 border-r border-white/10 bg-[#1a1a1a]">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="p-3 border-b border-white/5">
              <h3 className="text-slate-300 text-[11px] font-bold uppercase tracking-wider">Explorer</h3>
            </div>
            <FileExplorer 
              cwd={cwd} 
              onInject={handleFileClick}
              onPin={onPin} 
              onAddToInput={onAddToInput}
              pinnedFiles={pinnedFiles}
              disableInlineEditor={true}
            />
          </div>
        </div>
      )}

      {/* Editor Panel */}
      {showEditorPanel && (
        <div className="flex-1 border-r border-white/10 bg-[#1a1a1a] flex flex-col">
          {/* Tabs Bar */}
          {tabs.length > 0 && (
            <div className="flex items-center bg-[#252525] border-b border-white/10 overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId
                
                // Determine icon based on tab type
                let iconElement: React.ReactNode
                if (tab.type === 'browser') {
                  iconElement = (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                  )
                } else if (tab.type === 'terminal') {
                  iconElement = (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 17 10 11 4 5"></polyline>
                      <line x1="12" y1="19" x2="20" y2="19"></line>
                    </svg>
                  )
                } else if (tab.icon) {
                  iconElement = (
                    <img 
                      src={`https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons/icons/${tab.icon}`}
                      width="14" 
                      height="14" 
                      className="flex-shrink-0"
                      alt={tab.title}
                      style={{ objectFit: 'contain' }}
                    />
                  )
                }
                
                return (
                  <div
                    key={tab.id}
                    className={`group relative flex items-center gap-2 px-3 py-1.5 border-r border-white/5 cursor-pointer transition-all min-w-[120px] max-w-[200px] ${
                      isActive 
                        ? 'bg-[#1a1a1a] text-slate-200 border-t-2 border-t-indigo-500' 
                        : 'bg-[#252525] text-slate-400 hover:text-slate-200 hover:bg-[#2d2d2d] border-t-2 border-t-transparent'
                    }`}
                    onClick={() => setActiveTabId(tab.id)}
                    title={tab.type === 'file' ? tab.file?.path : tab.title}
                  >
                    {/* Icon */}
                    {iconElement}
                    
                    {/* Tab Title */}
                    <span className={`flex-1 text-[10px] truncate font-medium ${isActive ? 'text-slate-100' : ''}`}>
                      {tab.title}
                    </span>
                    
                    {/* Unsaved Indicator or Close Button */}
                    {tab.type === 'file' && tab.file?.hasUnsavedChanges ? (
                      <span className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" title="Unsaved changes" />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(tab.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-all flex-shrink-0"
                        title="Close (Ctrl+W)"
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Editor/Browser Content Area */}
          <div className="flex-1 flex flex-col min-h-0">
            {activeTab ? (
              <>
                {/* Main Content Area (Editor or Browser) */}
                <div className={`${showTerminal ? `flex-shrink-0` : 'flex-1'} relative`} style={{ height: showTerminal ? `${100 - terminalHeight}%` : '100%' }}>
                  {activeTab.type === 'file' && activeTab.file ? (
                    isLoadingFile ? (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-slate-600 text-[11px]">Loading...</span>
                      </div>
                    ) : (
                      <Editor
                        height="100%"
                        defaultLanguage="javascript"
                        language={getLanguageFromFilename(activeTab.file.path)}
                        value={activeTab.file.content}
                        onChange={(value) => handleFileContentChange(activeTab.id, value || '')}
                        theme="vs-dark"
                        options={{
                          fontSize: 13,
                          minimap: { enabled: true },
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          automaticLayout: true,
                          tabSize: 2,
                          insertSpaces: true,
                          formatOnPaste: true,
                          formatOnType: true,
                          renderWhitespace: 'selection',
                          bracketPairColorization: { enabled: true },
                          guides: {
                            bracketPairs: true,
                            indentation: true,
                          },
                        }}
                        beforeMount={(monaco) => {
                          // Disable validation but keep syntax highlighting
                          monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                            noSemanticValidation: true,
                            noSyntaxValidation: true,
                          })
                          monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                            noSemanticValidation: true,
                            noSyntaxValidation: true,
                          })
                        }}
                        onMount={(editor, monaco) => {
                          // Add Ctrl+S keybinding
                          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                            saveFileContent(activeTab.id)
                          })
                        }}
                      />
                    )
                  ) : activeTab.type === 'browser' ? (
                    <BrowserPreview onClose={onBrowserClose || (() => {})} />
                  ) : null}
                </div>
                
                {/* Terminal Split Resize Handle */}
                {showTerminal && (
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault()
                      const startY = e.clientY
                      const startHeight = terminalHeight
                      
                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        const deltaY = moveEvent.clientY - startY
                        const containerHeight = e.currentTarget.parentElement?.clientHeight || 600
                        const deltaPercent = (deltaY / containerHeight) * 100
                        const newHeight = Math.max(10, Math.min(70, startHeight + deltaPercent))
                        setTerminalHeight(newHeight)
                      }
                      
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove)
                        document.removeEventListener('mouseup', handleMouseUp)
                      }
                      
                      document.addEventListener('mousemove', handleMouseMove)
                      document.addEventListener('mouseup', handleMouseUp)
                    }}
                    className="h-1 w-full cursor-row-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group bg-white/5 hover:bg-indigo-500/50"
                  >
                    <div className="w-8 h-[1px] bg-white/20 group-hover:bg-white/50 transition-colors" />
                  </div>
                )}
                
                {/* Terminal Panel Below Editor/Browser */}
                {showTerminal && (
                  <div className="flex-1 min-h-[100px] relative" style={{ height: `${terminalHeight}%` }}>
                    <TerminalPanel onClose={onTerminalClose || (() => {})} cwd={cwd} />
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" 
                    strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-slate-600">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <p className="text-slate-500 text-[12px] mb-1">No file selected</p>
                  <p className="text-slate-600 text-[10px]">Click on a file in the explorer to open it</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Panel */}
      <div className={`${showEditorPanel ? 'w-96' : 'flex-1'} flex-shrink-0`}>
        {children}
      </div>
    </div>
  )
}

export default IDELayout