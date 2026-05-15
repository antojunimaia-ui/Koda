import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { MessageEntry, AttachedFile, AgentInfo, Mode, KodaTheme, KodaSettings, TrackedFile } from '../types/index.js'
import { FileExplorer } from './context/ContextPanel.js'
import { Codicon } from './Codicon.js'
import { getIconForFile } from 'vscode-icons-js'
import BrowserPreview from './BrowserPreview.js'
import TerminalPanel from './TerminalPanel.js'
import MarkdownWebview from './MarkdownWebview.js'

interface IDELayoutProps {
  // Explorer props
  showExplorerPanel: boolean
  cwd: string
  pinnedFiles: string[]
  onPin: (path: string) => void
  onInject: (path: string) => void
  onSend: (text: string, images: AttachedFile[], wsId: string) => void
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
  isDeleted?: boolean  // Track if file was deleted from disk
}

type TabType = 'file' | 'browser' | 'terminal' | 'markdown-preview' | 'video' | 'image'

interface Tab {
  id: string
  type: TabType
  title: string
  icon?: string
  file?: OpenFile
  markdownPath?: string  // for markdown-preview tabs
  videoPath?: string
  imagePath?: string
}

// ─── Image Viewer Component ──────────────────────────────────────────────────

const ImageViewer: React.FC<{ path: string }> = ({ path }) => {
  return (
    <div className="h-full w-full bg-[#141414] flex items-center justify-center p-8 overflow-auto custom-scrollbar">
      <img 
        src={`file://${path}`} 
        className="max-w-full max-h-full shadow-2xl rounded-sm object-contain"
        alt={path}
      />
    </div>
  )
}

// ─── Video Player Component ──────────────────────────────────────────────────

const VideoPlayer: React.FC<{ path: string }> = ({ path }) => {
  return (
    <div className="h-full w-full bg-[#141414] flex flex-col items-center justify-center relative group">
      <video 
        src={`file://${path}`} 
        controls 
        className="max-w-full max-h-full shadow-2xl rounded-lg"
        autoPlay
      />
    </div>
  )
}

// ─── Markdown Preview Component ───────────────────────────────────────────────
// Moved to MarkdownWebview.tsx (webview-based for security isolation)

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
  const [pendingImages, setPendingImages] = useState<AttachedFile[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [isLoadingFile, setIsLoadingFile] = useState(false)

  // ── Global Event Listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const handleOpenPreview = (e: any) => {
      if (e.detail && e.detail.path) {
        openMarkdownPreview(e.detail.path)
      }
    }
    const handleOpenVideo = (e: any) => {
      if (e.detail && e.detail.path) {
        openVideoPlayer(e.detail.path)
      }
    }
    window.addEventListener('koda:open-markdown-preview', handleOpenPreview)
    window.addEventListener('koda:open-video', handleOpenVideo)
    return () => {
      window.removeEventListener('koda:open-markdown-preview', handleOpenPreview)
      window.removeEventListener('koda:open-video', handleOpenVideo)
    }
  }, [tabs])
  const [terminalHeight, setTerminalHeight] = useState(250) // Pixels
  const [explorerWidth, setExplorerWidth] = useState(256) // Pixels
  const [chatWidth, setChatWidth] = useState(448) // Pixels
  const [discordEnabled, setDiscordEnabled] = useState(false)
  const [activityStartTime] = useState(Date.now())
  
  const activeTab = tabs.find(t => t.id === activeTabId)

  // Check Discord RPC status on mount
  useEffect(() => {
    ;(window.koda as any).discordIsEnabled().then((result: any) => {
      setDiscordEnabled(result.enabled)
    })
  }, [])

  // Update Discord activity when active tab changes
  useEffect(() => {
    if (!discordEnabled || !activeTab || activeTab.type !== 'file' || !activeTab.file) {
      return
    }

    const fileName = activeTab.file.path.split('/').pop() || activeTab.file.path
    const fileExt = fileName.split('.').pop()?.toLowerCase()
    const projectName = cwd.split('/').pop() || cwd.split('\\').pop() || 'Unknown Project'

    ;(window.koda as any).discordUpdateActivity({
      projectName,
      fileName,
      fileType: fileExt,
      startTimestamp: activityStartTime
    })
  }, [activeTab, discordEnabled, cwd, activityStartTime])

  // Adicionar tab do navegador quando showBrowser mudar
  useEffect(() => {
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

  // Listen for file system changes to mark deleted files
  useEffect(() => {
    const unsubscribe = window.koda.onFileSystemChange?.((change) => {
      if (change.type === 'rename' || change.type === 'change') {
        // Check if any open tab's file was deleted
        setTabs(prev => prev.map(tab => {
          if (tab.type === 'file' && tab.file) {
            const normalizedTabPath = tab.file.path.replace(/\\/g, '/')
            const normalizedChangePath = change.path.replace(/\\/g, '/')
            
            if (normalizedTabPath === normalizedChangePath) {
              // File was deleted or renamed, mark as deleted
              return {
                ...tab,
                file: {
                  ...tab.file,
                  isDeleted: true
                }
              }
            }
          }
          return tab
        }))
      }
    })
    
    return () => {
      unsubscribe?.()
    }
  }, [])

  const isVideo = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    return ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'].includes(ext)
  }

  const isImage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg'].includes(ext)
  }

  const openVideoPlayer = (filePath: string) => {
    const existingTab = tabs.find(t => t.type === 'video' && t.videoPath === filePath)
    if (existingTab) {
      setActiveTabId(existingTab.id)
      return
    }

    const fileName = filePath.replace(/\\/g, '/').split('/').pop() || filePath
    const newTab: Tab = {
      id: `video-${Date.now()}`,
      type: 'video',
      title: fileName,
      icon: getIconForFile(fileName),
      videoPath: filePath
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
  }

  const openImageViewer = (filePath: string) => {
    const existingTab = tabs.find(t => t.type === 'image' && t.imagePath === filePath)
    if (existingTab) {
      setActiveTabId(existingTab.id)
      return
    }

    const fileName = filePath.replace(/\\/g, '/').split('/').pop() || filePath
    const newTab: Tab = {
      id: `image-${Date.now()}`,
      type: 'image',
      title: fileName,
      icon: getIconForFile(fileName),
      imagePath: filePath
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
  }

  const loadFileContent = async (filePath: string) => {
    if (isVideo(filePath)) {
      openVideoPlayer(filePath)
      return
    }
    if (isImage(filePath)) {
      openImageViewer(filePath)
      return
    }
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
          content: result.content || '',
          hasUnsavedChanges: false
        }
        const fileName = filePath.replace(/\\/g, '/').split('/').pop() || filePath
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

  const openMarkdownPreview = async (filePath: string) => {
    // If a preview for this file already exists, just activate it
    const existingTab = tabs.find(t => t.type === 'markdown-preview' && t.markdownPath === filePath)
    if (existingTab) {
      setActiveTabId(existingTab.id)
      return
    }

    try {
      const result = await window.koda.readFile(filePath)
      if (result.success) {
        const fileName = filePath.replace(/\\/g, '/').split('/').pop() || filePath
        const newTab: Tab = {
          id: `md-preview-${Date.now()}`,
          type: 'markdown-preview',
          title: `Preview: ${fileName}`,
          markdownPath: filePath,
          file: {
            path: filePath,
            content: result.content || '',
            hasUnsavedChanges: false,
          },
        }
        setTabs(prev => [...prev, newTab])
        setActiveTabId(newTab.id)
      }
    } catch (error) {
      console.error('Error loading markdown file for preview:', error)
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
    // Normalize path separators and extract just the filename
    const baseName = filename.replace(/\\/g, '/').split('/').pop() || filename
    // Handle dotfiles like .gitignore, Dockerfile, etc.
    const lowerName = baseName.toLowerCase()
    const dotfileMap: Record<string, string> = {
      'dockerfile': 'dockerfile',
      '.dockerignore': 'plaintext',
      '.gitignore': 'plaintext',
      '.gitattributes': 'plaintext',
      '.env': 'ini',
      '.editorconfig': 'ini',
      'makefile': 'makefile',
      'cmakelists.txt': 'cmake',
      'gemfile': 'ruby',
      'rakefile': 'ruby',
      'procfile': 'plaintext',
    }
    if (dotfileMap[lowerName]) return dotfileMap[lowerName]

    const ext = lowerName.split('.').pop() || ''
    const languageMap: Record<string, string> = {
      // Web
      'js': 'javascript',
      'jsx': 'javascript',
      'mjs': 'javascript',
      'cjs': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'mts': 'typescript',
      'cts': 'typescript',
      'html': 'html',
      'htm': 'html',
      'xhtml': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'scss',
      'less': 'less',
      'vue': 'html',
      'svelte': 'html',
      // Data / Config
      'json': 'json',
      'jsonc': 'json',
      'json5': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'ini',
      'ini': 'ini',
      'env': 'ini',
      'xml': 'xml',
      'svg': 'xml',
      'plist': 'xml',
      'csproj': 'xml',
      'props': 'xml',
      'targets': 'xml',
      'gradle': 'kotlin',
      'pom': 'xml',
      // Docs
      'md': 'markdown',
      'mdx': 'markdown',
      'rst': 'restructuredtext',
      'tex': 'latex',
      // Systems
      'c': 'c',
      'h': 'c',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'hpp': 'cpp',
      'hxx': 'cpp',
      'cs': 'csharp',
      'java': 'java',
      'kt': 'kotlin',
      'kts': 'kotlin',
      'rs': 'rust',
      'go': 'go',
      'swift': 'swift',
      'mm': 'objective-c',
      'm': 'objective-c',
      // Scripting
      'py': 'python',
      'pyw': 'python',
      'rb': 'ruby',
      'php': 'php',
      'php3': 'php',
      'php4': 'php',
      'php5': 'php',
      'lua': 'lua',
      'pl': 'perl',
      'pm': 'perl',
      'r': 'r',
      'jl': 'julia',
      'ex': 'elixir',
      'exs': 'elixir',
      'erl': 'erlang',
      'hrl': 'erlang',
      'hs': 'haskell',
      'lhs': 'haskell',
      'clj': 'clojure',
      'cljs': 'clojure',
      'scala': 'scala',
      'sc': 'scala',
      'dart': 'dart',
      // Shell
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell',
      'ps1': 'powershell',
      'psm1': 'powershell',
      'psd1': 'powershell',
      'bat': 'bat',
      'cmd': 'bat',
      // SQL
      'sql': 'sql',
      'pgsql': 'pgsql',
      'mysql': 'mysql',
      // Other
      'graphql': 'graphql',
      'gql': 'graphql',
      'proto': 'proto',
      'tf': 'hcl',
      'hcl': 'hcl',
      'bicep': 'bicep',
      'zig': 'zig',
      'v': 'v',
      'nim': 'nim',
      'wasm': 'plaintext',
    }
    return languageMap[ext] || 'plaintext'
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
        <>
          <div className="flex-shrink-0 border-r border-white/10 bg-[#141414]" style={{ width: `${explorerWidth}px` }}>
            <div className="h-full overflow-y-auto custom-scrollbar">
              <div className="px-2 pt-1 pb-0.5 flex items-center justify-between">
                <h3 className="text-slate-300 text-[9px] font-bold uppercase tracking-wider">Explorer</h3>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      // Trigger new file creation in FileExplorer
                      window.dispatchEvent(new CustomEvent('koda:create-file', { detail: { parentPath: cwd } }))
                    }}
                    className="p-0.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded transition-colors"
                    title="New File"
                  >
                    <Codicon icon="new-file" size={14} />
                  </button>
                  <button
                    onClick={() => {
                      // Trigger new folder creation in FileExplorer
                      window.dispatchEvent(new CustomEvent('koda:create-folder', { detail: { parentPath: cwd } }))
                    }}
                    className="p-0.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded transition-colors"
                    title="New Folder"
                  >
                    <Codicon icon="new-folder" size={14} />
                  </button>
                  <button
                    onClick={() => {
                      // Trigger refresh in FileExplorer
                      window.dispatchEvent(new CustomEvent('koda:refresh-tree'))
                    }}
                    className="p-0.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded transition-colors"
                    title="Refresh"
                  >
                    <Codicon icon="refresh" size={14} />
                  </button>
                </div>
              </div>
              <FileExplorer 
                cwd={cwd} 
                onInject={handleFileClick}
                onPin={onPin} 
                onAddToInput={onAddToInput}
                pinnedFiles={pinnedFiles}
                disableInlineEditor={true}
                onOpenMarkdownPreview={openMarkdownPreview}
              />
            </div>
          </div>
          
          {/* Explorer Resize Handle */}
          <div
            onMouseDown={(e) => {
              e.preventDefault()
              const startX = e.clientX
              const startWidth = explorerWidth
              
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const deltaX = moveEvent.clientX - startX
                const newWidth = Math.max(200, Math.min(600, startWidth + deltaX))
                setExplorerWidth(newWidth)
              }
              
              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
              }
              
              document.addEventListener('mousemove', handleMouseMove)
              document.addEventListener('mouseup', handleMouseUp)
            }}
            className="w-1 cursor-col-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group bg-transparent hover:bg-indigo-500/50"
          >
            <div className="h-8 w-[1px] bg-white/20 group-hover:bg-white/50 transition-colors" />
          </div>
        </>
      )}

      {/* Editor Panel */}
      {showEditorPanel && (
        <>
          <div className="flex-1 border-r border-white/10 bg-[#141414] flex flex-col min-w-[300px]">
            {/* Tabs Bar */}
            {tabs.length > 0 && (
              <div className="flex items-center bg-[#252525] border-b border-white/10 overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
                {tabs.map((tab) => {
                  const isActive = tab.id === activeTabId
                  const isDeleted = tab.type === 'file' && tab.file?.isDeleted
                  
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
                  } else if (tab.type === 'markdown-preview') {
                    iconElement = (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )
                  } else if (tab.type === 'image') {
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
                        isDeleted
                          ? 'bg-red-900/20 text-red-400 border-t-2 border-t-red-500'
                          : isActive 
                            ? 'bg-[#141414] text-slate-200 border-t-2 border-t-indigo-500' 
                            : 'bg-[#252525] text-slate-400 hover:text-slate-200 hover:bg-[#2d2d2d] border-t-2 border-t-transparent'
                      }`}
                      onClick={() => setActiveTabId(tab.id)}
                      title={tab.type === 'file' ? (isDeleted ? `${tab.file?.path} (deleted)` : tab.file?.path) : tab.title}
                    >
                      {/* Icon */}
                      {iconElement}
                      
                      {/* Tab Title */}
                      <span className={`flex-1 text-[10px] truncate font-medium ${
                        isDeleted 
                          ? 'line-through text-red-400' 
                          : isActive ? 'text-slate-100' : ''
                      }`}>
                        {tab.title}
                      </span>
                      
                      {/* Deleted indicator or Unsaved Indicator or Close Button */}
                      {tab.type === 'file' && tab.file?.hasUnsavedChanges && !isDeleted ? (
                        <span className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" title="Unsaved changes" />
                      ) : null}
                      
                      {isDeleted && (
                        <span className="text-[9px] text-red-400 flex-shrink-0 mr-1" title="File deleted from disk">
                          ⚠
                        </span>
                      )}
                      
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
                  <div className={`${showTerminal ? 'flex-shrink-0' : 'flex-1'} relative`} style={{ height: showTerminal ? `calc(100% - ${terminalHeight}px - 4px)` : '100%' }}>
                    {activeTab.type === 'file' && activeTab.file ? (
                      isLoadingFile ? (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-slate-600 text-[11px]">Loading...</span>
                        </div>
                      ) : (
                        <Editor
                          height="100%"
                          language={getLanguageFromFilename(activeTab.file.path)}
                          value={activeTab.file.content}
                          onChange={(value) => handleFileContentChange(activeTab.id, value || '')}
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
                            // Semantic tokens improve highlight accuracy for TS/JS
                            'semanticHighlighting.enabled': true,
                          }}
                          beforeMount={(monaco) => {
                            // Register theme only once to avoid flicker on re-renders
                            if (!(monaco as any).__kodaThemeRegistered) {
                              (monaco as any).__kodaThemeRegistered = true

                              // Suppress TS/JS red-squiggles (we're not running a compiler)
                              monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                                noSemanticValidation: true,
                                noSyntaxValidation: true,
                              })
                              monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                                noSemanticValidation: true,
                                noSyntaxValidation: true,
                              })

                              // Enable JSX in TS/JS so .tsx/.jsx files get proper highlight
                              monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                                jsx: monaco.languages.typescript.JsxEmit.React,
                                jsxFactory: 'React.createElement',
                                allowNonTsExtensions: true,
                                allowJs: true,
                              })
                              monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                                jsx: monaco.languages.typescript.JsxEmit.React,
                                allowNonTsExtensions: true,
                              })

                              // Define Koda dark theme — token rules cover all major grammars
                              monaco.editor.defineTheme('koda-dark', {
                                base: 'vs-dark',
                                inherit: true,
                                rules: [
                                  // Comments
                                  { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                                  { token: 'comment.doc', foreground: '608B4E', fontStyle: 'italic' },
                                  // Keywords
                                  { token: 'keyword', foreground: 'C586C0' },
                                  { token: 'keyword.control', foreground: 'C586C0' },
                                  { token: 'keyword.operator', foreground: 'D4D4D4' },
                                  { token: 'keyword.other', foreground: 'C586C0' },
                                  // Storage / modifier keywords
                                  { token: 'storage', foreground: 'C586C0' },
                                  { token: 'storage.type', foreground: '569CD6' },
                                  { token: 'storage.modifier', foreground: '569CD6' },
                                  // Strings
                                  { token: 'string', foreground: 'CE9178' },
                                  { token: 'string.escape', foreground: 'D7BA7D' },
                                  { token: 'string.regexp', foreground: 'D16969' },
                                  // Numbers
                                  { token: 'number', foreground: 'B5CEA8' },
                                  { token: 'number.float', foreground: 'B5CEA8' },
                                  { token: 'number.hex', foreground: 'B5CEA8' },
                                  // Regexp
                                  { token: 'regexp', foreground: 'D16969' },
                                  // Types & Classes
                                  { token: 'type', foreground: '4EC9B0' },
                                  { token: 'type.identifier', foreground: '4EC9B0' },
                                  { token: 'class', foreground: '4EC9B0' },
                                  { token: 'class.name', foreground: '4EC9B0' },
                                  { token: 'interface', foreground: '4EC9B0' },
                                  { token: 'enum', foreground: '4EC9B0' },
                                  { token: 'struct', foreground: '4EC9B0' },
                                  { token: 'namespace', foreground: '4EC9B0' },
                                  // Functions
                                  { token: 'function', foreground: 'DCDCAA' },
                                  { token: 'function.call', foreground: 'DCDCAA' },
                                  { token: 'entity.name.function', foreground: 'DCDCAA' },
                                  { token: 'support.function', foreground: 'DCDCAA' },
                                  // Variables & Parameters
                                  { token: 'variable', foreground: '9CDCFE' },
                                  { token: 'variable.other', foreground: '9CDCFE' },
                                  { token: 'variable.parameter', foreground: '9CDCFE' },
                                  { token: 'parameter', foreground: '9CDCFE' },
                                  // Constants
                                  { token: 'constant', foreground: '4FC1FF' },
                                  { token: 'constant.language', foreground: '569CD6' },
                                  { token: 'constant.numeric', foreground: 'B5CEA8' },
                                  // Annotations / Decorators
                                  { token: 'annotation', foreground: 'DCDCAA' },
                                  { token: 'decorator', foreground: 'DCDCAA' },
                                  { token: 'metatag', foreground: 'DCDCAA' },
                                  // Operators & Delimiters
                                  { token: 'operator', foreground: 'D4D4D4' },
                                  { token: 'delimiter', foreground: 'D4D4D4' },
                                  { token: 'delimiter.bracket', foreground: 'D4D4D4' },
                                  { token: 'delimiter.parenthesis', foreground: 'D4D4D4' },
                                  // Punctuation
                                  { token: 'punctuation', foreground: 'D4D4D4' },
                                  // HTML / XML / JSX tags
                                  { token: 'tag', foreground: '569CD6' },
                                  { token: 'tag.id', foreground: '569CD6' },
                                  { token: 'tag.class', foreground: '569CD6' },
                                  { token: 'attribute.name', foreground: '9CDCFE' },
                                  { token: 'attribute.value', foreground: 'CE9178' },
                                  { token: 'metatag.html', foreground: 'C586C0' },
                                  // CSS specific
                                  { token: 'attribute', foreground: '9CDCFE' },
                                  { token: 'property', foreground: '9CDCFE' },
                                  { token: 'unit', foreground: 'B5CEA8' },
                                  // Markdown
                                  { token: 'strong', fontStyle: 'bold' },
                                  { token: 'emphasis', fontStyle: 'italic' },
                                ],
                                colors: {
                                  'editor.background': '#141414',
                                  'editor.foreground': '#D4D4D4',
                                  'editor.lineHighlightBackground': '#1A1A1A',
                                  'editor.lineHighlightBorder': '#00000000',
                                  'editorLineNumber.foreground': '#4A4A4A',
                                  'editorLineNumber.activeForeground': '#C6C6C6',
                                  'editor.selectionBackground': '#264F78',
                                  'editor.inactiveSelectionBackground': '#3A3D41',
                                  'editor.selectionHighlightBackground': '#2D2D2D',
                                  'editor.wordHighlightBackground': '#575757B8',
                                  'editor.wordHighlightStrongBackground': '#004972B8',
                                  'editorCursor.foreground': '#AEAFAD',
                                  'editorWhitespace.foreground': '#3A3A3A',
                                  'editorIndentGuide.background': '#404040',
                                  'editorIndentGuide.activeBackground': '#707070',
                                  'editorBracketMatch.background': '#0064001A',
                                  'editorBracketMatch.border': '#888888',
                                  'editorGutter.background': '#141414',
                                  'scrollbarSlider.background': '#79797966',
                                  'scrollbarSlider.hoverBackground': '#646464B3',
                                  'scrollbarSlider.activeBackground': '#BFBFBF66',
                                }
                              })
                            }
                          }}
                          onMount={(editor, monaco) => {
                            monaco.editor.setTheme('koda-dark')
                            
                            // Add Ctrl+S keybinding
                            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                              saveFileContent(activeTab.id)
                            })
                          }}
                        />
                      )
                    ) : activeTab.type === 'browser' ? (
                      <BrowserPreview onClose={onBrowserClose || (() => {})} />
                    ) : activeTab.type === 'markdown-preview' && activeTab.file ? (
                      <MarkdownWebview 
                        content={activeTab.file.content} 
                        filePath={activeTab.file.path}
                      />
                    ) : activeTab.type === 'video' && activeTab.videoPath ? (
                      <VideoPlayer path={activeTab.videoPath} />
                    ) : activeTab.type === 'image' && activeTab.imagePath ? (
                      <ImageViewer path={activeTab.imagePath} />
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
                          const deltaY = startY - moveEvent.clientY // Inverted because we're dragging up
                          const newHeight = Math.max(100, Math.min(600, startHeight + deltaY))
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
                    <div className="flex-shrink-0 relative" style={{ height: `${terminalHeight}px` }}>
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
          
          {/* Editor-Chat Resize Handle — only when Editor is visible */}
          {showEditorPanel && (
            <div
              onMouseDown={(e) => {
                e.preventDefault()
                const startX = e.clientX
                const startWidth = chatWidth
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const deltaX = startX - moveEvent.clientX // Inverted because chat is on the right
                  const newWidth = Math.max(300, Math.min(800, startWidth + deltaX))
                  setChatWidth(newWidth)
                }
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove)
                  document.removeEventListener('mouseup', handleMouseUp)
                }
                
                document.addEventListener('mousemove', handleMouseMove)
                document.addEventListener('mouseup', handleMouseUp)
              }}
              className="w-1 cursor-col-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group bg-transparent hover:bg-indigo-500/50"
            >
              <div className="h-8 w-[1px] bg-white/20 group-hover:bg-white/50 transition-colors" />
            </div>
          )}
        </>
      )}

      {/* Chat Panel — fixed width when Editor is visible, flex-1 otherwise */}
      <div
        className={showEditorPanel ? 'flex-shrink-0' : 'flex-1 min-w-0'}
        style={showEditorPanel ? { width: `${chatWidth}px` } : undefined}
      >
        {children}
      </div>
    </div>
  )
}

export default IDELayout