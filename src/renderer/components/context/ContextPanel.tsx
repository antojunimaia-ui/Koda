import React, { memo, useState, useEffect } from 'react'
import { TrackedFile } from '../../types/index.js'

interface ContextPanelProps {
  files: TrackedFile[]
  pinnedFiles: string[]
  onPin: (path: string) => void
  onUnpin: (path: string) => void
  onInject: (path: string) => void
  onAddToInput?: (path: string) => void
  cwd: string
  width?: number
  explorerTabPosition?: 'panel' | 'iconbar' | 'titlebar'
  onExplorerTabPositionChange?: (pos: 'panel' | 'iconbar' | 'titlebar') => void
  showExplorerTab?: boolean
  activeTab?: 'context' | 'explorer'
  onTabChange?: (tab: 'context' | 'explorer') => void
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round"
    className={`flex-shrink-0 transition-transform duration-150 text-slate-600 ${open ? 'rotate-90' : ''}`}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const IconFolder = ({ open }: { open: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-amber-400/80">
    {open
      ? <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="2" y1="10" x2="22" y2="10" /></>
      : <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />}
  </svg>
)

const IconFile = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-slate-500">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const IconAt = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-indigo-400">
    <circle cx="12" cy="12" r="4"/>
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
  </svg>
)

const IconPin = ({ active }: { active: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={active ? 'text-indigo-400' : 'text-slate-600 hover:text-indigo-400'}>
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </svg>
)

// ─── Explorer Tab Button with context menu ───────────────────────────────────

const ExplorerTabButton: React.FC<{
  active: boolean
  onClick: () => void
  position: 'panel' | 'iconbar' | 'titlebar'
  onMoveTo: (pos: 'panel' | 'iconbar' | 'titlebar') => void
  variant?: 'panel' | 'iconbar' | 'titlebar'
}> = ({ active, onClick, position, onMoveTo, variant = 'panel' }) => {
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const folderSvg = (size: number) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )

  const btn = variant === 'panel' ? (
    <button onClick={onClick} onContextMenu={onContextMenu}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${active ? 'bg-white/8 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
      title="Explorer (right-click to move)">
      {folderSvg(10)} Explorer
    </button>
  ) : variant === 'iconbar' ? (
    <button onClick={onClick} onContextMenu={onContextMenu}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${active ? 'bg-amber-500/10 text-amber-400' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
      title="Explorer (right-click to move)">
      {folderSvg(16)}
    </button>
  ) : (
    <button onClick={onClick} onContextMenu={onContextMenu}
      className={`w-7 h-7 flex items-center justify-center rounded transition-all no-drag ml-1 ${active ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-amber-400 hover:bg-white/5'}`}
      title="Explorer (right-click to move)">
      {folderSvg(14)}
    </button>
  )

  const LOCATIONS: { id: 'panel' | 'iconbar' | 'titlebar'; label: string; icon: React.ReactNode }[] = [
    { id: 'panel', label: 'Context Panel', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
    { id: 'iconbar', label: 'Iconbar', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="4" height="18" rx="1"/><path d="M7 12h14"/></svg> },
    { id: 'titlebar', label: 'Title Bar', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M12 7v14"/></svg> },
  ]

  return (
    <>
      {btn}
      {menu && (
        <div ref={menuRef} className="fixed z-[9999] bg-[#141414] border border-white/10 rounded-xl shadow-2xl py-1 w-52" style={{ top: menu.y, left: menu.x }}>
          <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-600">Move to</div>
          {LOCATIONS.map(loc => (
            <button key={loc.id} onClick={() => { onMoveTo(loc.id); setMenu(null) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${position === loc.id ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-300 hover:bg-white/5'}`}>
              {loc.icon}
              {loc.label}
              {position === loc.id && <span className="ml-auto text-[9px] text-indigo-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export { ExplorerTabButton }

interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

function buildTree(paths: string[], cwd: string): FileNode[] {
  const root: Record<string, any> = {}
  const normalCwd = cwd.replace(/\\/g, '/')

  for (const p of paths) {
    const normalP = p.replace(/\\/g, '/')
    const rel = normalP.startsWith(normalCwd)
      ? normalP.slice(normalCwd.length).replace(/^\//, '')
      : normalP
    if (!rel) continue
    const parts = rel.split('/')
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue
      if (!node[part]) {
        node[part] = {
          __path: normalCwd + '/' + parts.slice(0, i + 1).join('/'),
          __children: {}
        }
      }
      node = node[part].__children
    }
  }

  function toNodes(obj: Record<string, any>): FileNode[] {
    return Object.entries(obj)
      .map(([name, val]) => ({
        name,
        path: val.__path,
        isDir: Object.keys(val.__children).length > 0,
        children: toNodes(val.__children),
      }))
      .sort((a, b) => {
        if (a.isDir && !b.isDir) return -1
        if (!a.isDir && b.isDir) return 1
        return a.name.localeCompare(b.name)
      })
  }

  return toNodes(root)
}

const FileExplorer: React.FC<{
  cwd: string
  onInject: (path: string) => void
  onPin: (path: string) => void
  onAddToInput?: (path: string) => void
  pinnedFiles: string[]
}> = ({ cwd, onInject, onPin, onAddToInput, pinnedFiles }) => {
  const [tree, setTree] = useState<FileNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const loadFileContent = async (filePath: string) => {
    setIsLoadingFile(true)
    try {
      const result = await window.koda.readFile(filePath)
      if (result.success) {
        setFileContent(result.content)
        setSelectedFile(filePath)
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      console.error('Error loading file:', error)
    } finally {
      setIsLoadingFile(false)
    }
  }

  const saveFileContent = async () => {
    if (!selectedFile) return
    try {
      await window.koda.writeFile(selectedFile, fileContent)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Error saving file:', error)
    }
  }

  const handleFileContentChange = (newContent: string) => {
    setFileContent(newContent)
    setHasUnsavedChanges(true)
  }

  useEffect(() => {
    if (!cwd || cwd === '...') return
    setLoading(true)
    window.koda.getFiles().then((res: any) => {
      if (res.success) {
        const normalCwd = cwd.replace(/\\/g, '/')
        const absPaths = res.files.map((f: string) => normalCwd + '/' + f.replace(/\\/g, '/'))
        setTree(buildTree(absPaths, normalCwd))
      }
      setLoading(false)
    })
  }, [cwd])

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const renderNode = (node: FileNode, depth = 0) => {
    const isPinned = pinnedFiles.includes(node.path)
    const isOpen = expanded.has(node.path)
    const isSelected = selectedFile === node.path

    return (
      <div key={node.path}>
        <div
          className={`group flex items-center gap-1.5 py-[3px] pr-2 rounded-md cursor-pointer transition-colors ${
            isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5'
          }`}
          style={{ paddingLeft: `${6 + depth * 14}px` }}
          onClick={() => {
            if (node.isDir) {
              toggle(node.path)
            } else {
              loadFileContent(node.path)
            }
          }}
          title={node.path}
        >
          {node.isDir
            ? <IconChevron open={isOpen} />
            : <span className="w-[10px] flex-shrink-0" />
          }
          {node.isDir ? <IconFolder open={isOpen} /> : <IconFile />}
          <span className={`flex-1 text-[11px] truncate transition-colors ${
            isSelected ? 'text-indigo-200' : 'text-slate-400 group-hover:text-slate-200'
          }`}>
            {node.name}
          </span>
          {!node.isDir && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onAddToInput && (
                <button
                  onClick={e => { e.stopPropagation(); onAddToInput(node.path) }}
                  className="p-0.5 hover:bg-indigo-500/20 rounded transition-colors"
                  title="Add to input"
                >
                  <IconAt />
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); onInject(node.path) }}
                className="p-0.5 hover:bg-cyan-500/20 rounded transition-colors"
                title="Inject to context"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
                  <path d="M3 6h18M3 12h12M3 18h8" />
                </svg>
              </button>
              <button
                onClick={e => { e.stopPropagation(); onPin(node.path) }}
                className={`p-0.5 transition-opacity ${isPinned ? 'opacity-100' : ''}`}
                title={isPinned ? 'Pinned' : 'Pin to context'}
              >
                <IconPin active={isPinned} />
              </button>
            </div>
          )}
        </div>
        {node.isDir && isOpen && node.children?.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <span className="text-slate-600 text-[10px]">Loading...</span>
    </div>
  )

  if (tree.length === 0) return (
    <div className="flex items-center justify-center py-8">
      <span className="text-slate-600 text-[10px]">No files found.</span>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* File Editor */}
      {selectedFile && (
        <div className="w-1/2 border-r border-white/10 flex flex-col">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#0a0a0b]">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 text-[10px] font-medium truncate" title={selectedFile}>
                {selectedFile.split('/').pop()}
              </span>
              {hasUnsavedChanges && (
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" title="Unsaved changes" />
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasUnsavedChanges && (
                <button
                  onClick={saveFileContent}
                  className="px-2 py-1 text-[9px] bg-indigo-500/20 text-indigo-300 rounded hover:bg-indigo-500/30 transition-colors"
                  title="Save (Ctrl+S)"
                >
                  Save
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedFile(null)
                  setFileContent('')
                  setHasUnsavedChanges(false)
                }}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                title="Close"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Editor Content */}
          <div className="flex-1 relative">
            {isLoadingFile ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-slate-600 text-[10px]">Loading...</span>
              </div>
            ) : (
              <textarea
                value={fileContent}
                onChange={(e) => handleFileContentChange(e.target.value)}
                className="w-full h-full p-3 bg-transparent text-slate-300 text-[11px] font-mono leading-relaxed resize-none outline-none"
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}
                placeholder="File content will appear here..."
                onKeyDown={(e) => {
                  if (e.ctrlKey && e.key === 's') {
                    e.preventDefault()
                    saveFileContent()
                  }
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* File Tree */}
      <div className={`${selectedFile ? 'w-1/2' : 'w-full'} transition-all duration-200 overflow-y-auto custom-scrollbar`}>
        <div className="px-1 py-1">{tree.map(n => renderNode(n))}</div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ContextPanel = memo(({ files, pinnedFiles, onPin, onUnpin, onInject, onAddToInput, cwd, explorerTabPosition = 'panel', onExplorerTabPositionChange, showExplorerTab = true, activeTab: controlledTab, onTabChange }: ContextPanelProps) => {
  const [internalTab, setInternalTab] = useState<'context' | 'explorer'>('context')
  const tab = controlledTab ?? internalTab
  const setTab = (t: 'context' | 'explorer') => { setInternalTab(t); onTabChange?.(t) }

  const shortPath = (absPath: string) => absPath.replace(cwd, '').replace(/^[/\\]/, '') || absPath

  const modifiedFiles = files.filter(f => f.access === 'modified')
  const readFiles = files.filter(f => f.access === 'read' && !modifiedFiles.find(m => m.path === f.path))

  const FileRow = ({ file, badge }: { file: TrackedFile; badge: React.ReactNode }) => {
    const isPinned = pinnedFiles.includes(file.path)
    return (
      <div
        className="group flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 cursor-pointer transition-colors"
        onClick={() => onInject(file.path)}
        title={file.path}
      >
        {badge}
        <span className="flex-1 text-slate-400 text-[11px] truncate group-hover:text-slate-200 transition-colors">
          {shortPath(file.path)}
        </span>
        <button
          onClick={e => { e.stopPropagation(); isPinned ? onUnpin(file.path) : onPin(file.path) }}
          className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 ${isPinned ? 'opacity-100' : ''}`}
          title={isPinned ? 'Unpin' : 'Pin'}
        >
          <IconPin active={isPinned} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#0a0a0b]">

      {/* Header */}
      <div className="flex items-center gap-0.5 px-2 pt-2 pb-1.5 border-b border-white/5 flex-shrink-0">
        <button
          onClick={() => setTab('context')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
            tab === 'context' ? 'bg-white/8 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
          }`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h12M3 18h8" />
          </svg>
          Context
        </button>
        {showExplorerTab && (
          <ExplorerTabButton
            active={tab === 'explorer'}
            onClick={() => setTab('explorer')}
            position={explorerTabPosition}
            onMoveTo={(pos) => onExplorerTabPositionChange?.(pos)}
            variant="panel"
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* ── Context tab ── */}
        {tab === 'context' && (
          <div className="py-2">
            {pinnedFiles.length > 0 && (
              <div className="mb-4">
                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600 mb-1">Pinned</div>
                {pinnedFiles.map(path => (
                  <div
                    key={path}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => onInject(path)}
                    title={path}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="flex-1 text-slate-300 text-[11px] truncate group-hover:text-white transition-colors">
                      {shortPath(path)}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); onUnpin(path) }}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all text-[9px] p-0.5"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {modifiedFiles.length > 0 && (
              <div className="mb-4">
                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600 mb-1">Modified</div>
                {modifiedFiles.map(f => (
                  <FileRow key={f.path} file={f}
                    badge={<span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 flex-shrink-0" />}
                  />
                ))}
              </div>
            )}

            {readFiles.length > 0 && (
              <div className="mb-4">
                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600 mb-1">Read</div>
                {readFiles.map(f => (
                  <FileRow key={f.path} file={f}
                    badge={<span className="w-1.5 h-1.5 rounded-full bg-slate-700 flex-shrink-0" />}
                  />
                ))}
              </div>
            )}

            {files.length === 0 && pinnedFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
                  <path d="M3 6h18M3 12h12M3 18h8" />
                </svg>
                <span className="text-slate-600 text-[10px] text-center leading-relaxed">
                  No files tracked yet.<br />Start a task to see activity.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Explorer tab ── */}
        {tab === 'explorer' && (
          <FileExplorer cwd={cwd} onInject={onInject} onPin={onPin} onAddToInput={onAddToInput} pinnedFiles={pinnedFiles} />
        )}
      </div>
    </div>
  )
})

ContextPanel.displayName = 'ContextPanel'

export default ContextPanel

// ─── Resizable Overlay ────────────────────────────────────────────────────────

interface ContextPanelOverlayProps extends ContextPanelProps {
  width: number
  isResizing: boolean
  onStartResize: () => void
}

export const ContextPanelOverlay: React.FC<ContextPanelOverlayProps> = ({ width, isResizing, onStartResize, ...props }) => {
  return (
    <div
      className="absolute top-10 bottom-0 right-0 z-50 animate-in slide-in-from-right duration-200 shadow-2xl flex bg-[#0a0a0b] border-l border-white/5"
      style={{ width }}
    >
      <div
        onMouseDown={onStartResize}
        className={`w-1 h-full cursor-col-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${isResizing ? 'bg-indigo-500 w-1.5' : 'bg-white/5 hover:bg-indigo-500/50'}`}
      >
        <div className={`w-[1px] h-8 bg-white/20 group-hover:bg-white/50 transition-colors ${isResizing ? 'bg-white' : ''}`} />
      </div>
      <ContextPanel {...props} />
    </div>
  )
}

// ─── Standalone Explorer Panel Overlay ───────────────────────────────────────

interface ExplorerPanelOverlayProps {
  cwd: string
  pinnedFiles: string[]
  onPin: (path: string) => void
  onInject: (path: string) => void
  onAddToInput?: (path: string) => void
  onClose: () => void
  explorerTabPosition: 'iconbar' | 'titlebar'
  onMoveTo: (pos: 'panel' | 'iconbar' | 'titlebar') => void
}

export const ExplorerPanelOverlay: React.FC<ExplorerPanelOverlayProps> = ({
  cwd, pinnedFiles, onPin, onInject, onAddToInput, onClose, explorerTabPosition, onMoveTo
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const isResizing = React.useRef(false)
  const startX = React.useRef(0)
  const startWidth = React.useRef(0)
  const [width, setWidth] = React.useState(256)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = containerRef.current?.offsetWidth ?? 256
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !containerRef.current) return
      const newWidth = Math.max(180, Math.min(520, window.innerWidth - e.clientX))
      containerRef.current.style.width = `${newWidth}px`
    }
    const onMouseUp = (e: MouseEvent) => {
      if (!isResizing.current) return
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setWidth(Math.max(180, Math.min(520, window.innerWidth - e.clientX)))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute top-10 bottom-0 right-0 z-50 animate-in slide-in-from-right duration-200 shadow-2xl flex flex-col bg-[#0a0a0b] border-l border-white/5"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-[100] flex-shrink-0 flex items-center justify-center group bg-white/5 hover:bg-indigo-500/50 transition-colors"
      >
        <div className="w-[1px] h-8 bg-white/20 group-hover:bg-white/50 transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-white/5 flex-shrink-0 pl-4">
        <ExplorerTabButton
          active={true}
          onClick={onClose}
          position={explorerTabPosition}
          onMoveTo={onMoveTo}
          variant="panel"
        />
        <button
          onClick={onClose}
          className="text-slate-600 hover:text-slate-400 transition-colors p-1"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <FileExplorer cwd={cwd} onInject={onInject} onPin={onPin} onAddToInput={onAddToInput} pinnedFiles={pinnedFiles} />
      </div>
    </div>
  )
}
