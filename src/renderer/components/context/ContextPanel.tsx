import React, { memo, useState, useEffect } from 'react'
import { TrackedFile } from '../../types/index.js'
import { getIconForFile, getIconForFolder, getIconForOpenFolder } from 'vscode-icons-js'
import { ContextMenu, ContextMenuItem } from '../ContextMenu.js'
import { Codicon } from '../Codicon.js'

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
  <svg width="16" height="16" viewBox="0 0 32 32" fill="none" className="flex-shrink-0">
    <path d="M28 4H14L10 8H4C2.9 8 2 8.9 2 10V26C2 27.1 2.9 28 4 28H28C29.1 28 30 27.1 30 26V6C30 4.9 29.1 4 28 4Z" fill="#6B7280"/>
  </svg>
)

const getFileIcon = (filename: string) => {
  const iconName = getIconForFile(filename)
  
  // Usar CDN do jsdelivr para carregar os ícones do vscode-icons
  return (
    <img 
      src={`https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons/icons/${iconName}`}
      width="16" 
      height="16" 
      className="flex-shrink-0"
      alt={filename}
      style={{ objectFit: 'contain' }}
    />
  )
}

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

export { FileExplorer }

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
  onOpenMarkdownPreview?: (path: string) => void
  pinnedFiles: string[]
  disableInlineEditor?: boolean
}> = ({ cwd, onInject, onPin, onAddToInput, onOpenMarkdownPreview, pinnedFiles, disableInlineEditor = false }) => {
  const [tree, setTree] = useState<FileNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDir?: boolean } | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creatingNew, setCreatingNew] = useState<{ type: 'file' | 'folder'; parentPath: string } | null>(null)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null)

  const [loadedPaths, setLoadedPaths] = useState<Set<string>>(new Set())

  const updateNodeInTree = (nodes: FileNode[], targetPath: string, newChildren: FileNode[]): FileNode[] => {
    return nodes.map(node => {
      if (node.path === targetPath) {
        return { ...node, children: newChildren }
      }
      if (node.children) {
        return { ...node, children: updateNodeInTree(node.children, targetPath, newChildren) }
      }
      return node
    })
  }

  const findNodeInTree = (nodes: FileNode[], targetPath: string): FileNode | undefined => {
    for (const node of nodes) {
      if (node.path === targetPath) return node
      if (node.children) {
        const found = findNodeInTree(node.children, targetPath)
        if (found) return found
      }
    }
    return undefined
  }

  const reloadFolder = (folderPath: string) => {
    const normalPath = folderPath.replace(/\\/g, '/')
    window.koda.listDirLazy(normalPath).then((res: any) => {
      if (res.success) {
        const childNodes = res.files.map((f: any) => ({
          name: f.name,
          path: f.path,
          isDir: f.isDir,
          children: f.isDir ? [] : undefined
        }))
        
        const normalCwd = cwd.replace(/\\/g, '/')
        if (normalPath === normalCwd) {
          setTree(prevTree => {
            return childNodes.map((n: any) => {
              const existingNode = prevTree.find(p => p.path === n.path)
              if (existingNode && existingNode.isDir) {
                return { ...n, children: existingNode.children }
              }
              return n
            })
          })
        } else {
          setTree(prevTree => {
            return updateNodeInTree(prevTree, normalPath, childNodes.map((n: any) => {
              const existingNode = findNodeInTree(prevTree, n.path)
              if (existingNode && existingNode.isDir) {
                return { ...n, children: existingNode.children }
              }
              return n
            }))
          })
        }
      }
    })
  }

  const handleCreateFile = async (parentPath: string, fileName: string) => {
    try {
      const filePath = `${parentPath}/${fileName}`
      await window.koda.writeFile(filePath, '')
      reloadFolder(parentPath)
      setCreatingNew(null)
    } catch (error) {
      console.error('Error creating file:', error)
    }
  }

  const handleCreateFolder = async (parentPath: string, folderName: string) => {
    try {
      const folderPath = `${parentPath}/${folderName}`
      await window.koda.createFolder?.(folderPath)
      reloadFolder(parentPath)
      setCreatingNew(null)
    } catch (error) {
      console.error('Error creating folder:', error)
    }
  }

  const handleRename = async (oldPath: string, newFileName: string) => {
    try {
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'))
      const newPath = `${parentPath}/${newFileName}`
      await window.koda.renameFile?.(oldPath, newPath)
      reloadFolder(parentPath)
      setRenamingPath(null)
      setNewName('')
    } catch (error) {
      console.error('Error renaming:', error)
    }
  }

  const handleDelete = async (filePath: string) => {
    try {
      const parentPath = filePath.substring(0, filePath.lastIndexOf('/'))
      await window.koda.deleteFile?.(filePath)
      reloadFolder(parentPath)
    } catch (error) {
      console.error('Error deleting:', error)
    }
  }

  const handleMove = async (sourcePath: string, targetFolderPath: string) => {
    try {
      const fileName = sourcePath.split('/').pop()
      const newPath = `${targetFolderPath}/${fileName}`
      
      // Check if target already exists
      if (sourcePath === newPath) return
      
      await window.koda.renameFile?.(sourcePath, newPath)
      
      const sourceParentPath = sourcePath.substring(0, sourcePath.lastIndexOf('/'))
      reloadFolder(sourceParentPath)
      reloadFolder(targetFolderPath)
    } catch (error) {
      console.error('Error moving:', error)
    }
  }

  const handleDragStart = (e: React.DragEvent, path: string) => {
    setDraggedItem(path)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', path)
  }

  const handleDragOver = (e: React.DragEvent, path: string, isDir: boolean) => {
    if (!draggedItem) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mouseY = e.clientY - rect.top
    const height = rect.height
    
    // Determine position based on mouse Y position
    if (isDir) {
      // For folders: top 25% = before, middle 50% = inside, bottom 25% = after
      if (mouseY < height * 0.25) {
        setDropPosition('before')
      } else if (mouseY > height * 0.75) {
        setDropPosition('after')
      } else {
        setDropPosition('inside')
      }
    } else {
      // For files: top 50% = before, bottom 50% = after
      if (mouseY < height * 0.5) {
        setDropPosition('before')
      } else {
        setDropPosition('after')
      }
    }
    
    setDropTarget(path)
  }

  const handleDragLeave = () => {
    setDropTarget(null)
    setDropPosition(null)
  }

  const handleDrop = (e: React.DragEvent, targetPath: string, isDir: boolean) => {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetPath) {
      setDraggedItem(null)
      setDropTarget(null)
      setDropPosition(null)
      return
    }

    // Don't allow dropping into itself or its children
    if (targetPath.startsWith(draggedItem + '/')) {
      setDraggedItem(null)
      setDropTarget(null)
      setDropPosition(null)
      return
    }

    if (dropPosition === 'inside' && isDir) {
      // Move into folder
      handleMove(draggedItem, targetPath)
    } else if (dropPosition === 'before' || dropPosition === 'after') {
      // Reorder: move to same parent as target
      const targetParent = targetPath.substring(0, targetPath.lastIndexOf('/'))
      const draggedParent = draggedItem.substring(0, draggedItem.lastIndexOf('/'))
      
      if (targetParent === draggedParent) {
        // Same parent - just reordering (visual only for now, file system doesn't support order)
        console.log(`Reorder: ${draggedItem} ${dropPosition} ${targetPath}`)
        // Note: File systems don't have inherent order, so this is visual feedback only
        // The actual order is determined by the file system's listing
      } else {
        // Different parent - move to target's parent
        handleMove(draggedItem, targetParent)
      }
    }
    
    setDraggedItem(null)
    setDropTarget(null)
    setDropPosition(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDropTarget(null)
    setDropPosition(null)
  }

  const getContextMenuItems = (filePath: string, isDir: boolean = false): ContextMenuItem[] => {
    const fileName = filePath.split('/').pop() || ''
    const items: ContextMenuItem[] = []

    // Folder-specific options
    if (isDir) {
      items.push({
        id: 'new-file',
        label: 'New File',
        icon: 'new-file',
        onClick: () => {
          setExpanded(prev => new Set(prev).add(filePath))
          setCreatingNew({ type: 'file', parentPath: filePath })
        }
      })
      items.push({
        id: 'new-folder',
        label: 'New Folder',
        icon: 'new-folder',
        onClick: () => {
          setExpanded(prev => new Set(prev).add(filePath))
          setCreatingNew({ type: 'folder', parentPath: filePath })
        }
      })
      items.push({ id: 'sep0', label: '', separator: true })
    }

    // File-specific options
    if (!isDir) {
      // Markdown preview option
      if (isMarkdown(fileName)) {
        items.push({
          id: 'preview',
          label: 'Open Preview',
          icon: 'preview',
          onClick: () => {
            if (onOpenMarkdownPreview) {
              onOpenMarkdownPreview(filePath)
            } else {
              window.dispatchEvent(new CustomEvent('koda:open-markdown-preview', { detail: { path: filePath } }))
            }
          }
        })
        items.push({ id: 'sep1', label: '', separator: true })
      }

      // Open file
      items.push({
        id: 'open',
        label: 'Open File',
        icon: 'file',
        onClick: () => {
          if (disableInlineEditor) {
            onInject(filePath)
          } else {
            loadFileContent(filePath)
          }
        }
      })

      // Add to context
      items.push({
        id: 'inject',
        label: 'Add to Context',
        icon: 'add',
        onClick: () => onInject(filePath)
      })

      // Add to input
      if (onAddToInput) {
        items.push({
          id: 'add-input',
          label: 'Add to Input',
          icon: 'mention',
          onClick: () => onAddToInput(filePath)
        })
      }

      items.push({ id: 'sep2', label: '', separator: true })

      // Pin/Unpin
      const isPinned = pinnedFiles.includes(filePath)
      items.push({
        id: 'pin',
        label: isPinned ? 'Unpin' : 'Pin',
        icon: 'pin',
        onClick: () => onPin(filePath)
      })

      items.push({ id: 'sep3', label: '', separator: true })
    }

    // Rename
    items.push({
      id: 'rename',
      label: 'Rename',
      icon: 'edit',
      keybinding: 'F2',
      onClick: () => {
        setRenamingPath(filePath)
        setNewName(fileName)
      }
    })

    // Delete
    items.push({
      id: 'delete',
      label: 'Delete',
      icon: 'trash',
      keybinding: 'Del',
      onClick: () => {
        if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
          handleDelete(filePath)
        }
      }
    })

    return items
  }

  const loadFileContent = async (filePath: string) => {
    setIsLoadingFile(true)
    try {
      const result = await window.koda.readFile(filePath)
      if (result.success) {
        setFileContent(result.content || '')
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
    setLoadedPaths(new Set())
    setExpanded(new Set())
    const normalCwd = cwd.replace(/\\/g, '/')
    window.koda.listDirLazy(normalCwd).then((res: any) => {
      if (res.success) {
        const rootNodes = res.files.map((f: any) => ({
          name: f.name,
          path: f.path,
          isDir: f.isDir,
          children: f.isDir ? [] : undefined
        }))
        setTree(rootNodes)
      }
      setLoading(false)
    })
  }, [cwd])

  // Listen for custom events from header buttons
  useEffect(() => {
    const handleCreateFile = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setCreatingNew({ type: 'file', parentPath: detail.parentPath || cwd })
    }

    const handleCreateFolder = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setCreatingNew({ type: 'folder', parentPath: detail.parentPath || cwd })
    }

    const handleRefresh = () => {
      const normalCwd = cwd.replace(/\\/g, '/')
      reloadFolder(normalCwd)
    }

    window.addEventListener('koda:create-file', handleCreateFile)
    window.addEventListener('koda:create-folder', handleCreateFolder)
    window.addEventListener('koda:refresh-tree', handleRefresh)

    return () => {
      window.removeEventListener('koda:create-file', handleCreateFile)
      window.removeEventListener('koda:create-folder', handleCreateFolder)
      window.removeEventListener('koda:refresh-tree', handleRefresh)
    }
  }, [cwd])

  // Listen for file system changes
  useEffect(() => {
    if (!cwd || cwd === '...') return
    
    const unsubscribe = window.koda.onFileSystemChange?.((change) => {
      const changedDir = change.directory.replace(/\\/g, '/')
      const normalCwd = cwd.replace(/\\/g, '/')
      if (changedDir === normalCwd || loadedPaths.has(changedDir)) {
        console.log(`[FileExplorer] File system change in ${changedDir}, reloading...`);
        reloadFolder(changedDir)
      }
    })
    
    return () => {
      unsubscribe?.()
    }
  }, [cwd, loadedPaths])

  const toggle = (path: string) => {
    const normalPath = path.replace(/\\/g, '/')
    const isExpanding = !expanded.has(normalPath)
    
    if (isExpanding && !loadedPaths.has(normalPath)) {
      window.koda.listDirLazy(normalPath).then((res: any) => {
        if (res.success) {
          const childNodes = res.files.map((f: any) => ({
            name: f.name,
            path: f.path,
            isDir: f.isDir,
            children: f.isDir ? [] : undefined
          }))
          setTree(prevTree => updateNodeInTree(prevTree, normalPath, childNodes))
          setLoadedPaths(prev => {
            const next = new Set(prev)
            next.add(normalPath)
            return next
          })
          setExpanded(prev => {
            const next = new Set(prev)
            next.add(normalPath)
            return next
          })
        }
      })
    } else {
      setExpanded(prev => {
        const next = new Set(prev)
        next.has(normalPath) ? next.delete(normalPath) : next.add(normalPath)
        return next
      })
    }
  }

  const renderNode = (node: FileNode, depth = 0) => {
    const isPinned = pinnedFiles.includes(node.path)
    const isOpen = expanded.has(node.path)
    const isSelected = selectedFile === node.path
    const isDragging = draggedItem === node.path
    const isDropTarget = dropTarget === node.path
    const showBeforeLine = isDropTarget && dropPosition === 'before'
    const showAfterLine = isDropTarget && dropPosition === 'after'
    const showInsideHighlight = isDropTarget && dropPosition === 'inside'

    return (
      <div key={node.path} className="relative">
        {/* Drop indicator line - BEFORE */}
        {showBeforeLine && (
          <div 
            className="absolute left-0 right-0 h-[2px] bg-cyan-400 z-10"
            style={{ 
              top: '-1px',
              marginLeft: `${6 + depth * 14}px`
            }}
          />
        )}
        
        <div
          className={`group flex items-center gap-1.5 py-[3px] pr-2 rounded-md cursor-pointer transition-colors ${
            isSelected ? 'bg-indigo-500/20 text-indigo-300' : 
            isDragging ? 'opacity-50' :
            showInsideHighlight ? 'bg-cyan-500/20 border border-cyan-500/50' :
            'hover:bg-white/5'
          }`}
          style={{ paddingLeft: `${6 + depth * 14}px` }}
          draggable={!renamingPath}
          onDragStart={(e) => handleDragStart(e, node.path)}
          onDragOver={(e) => handleDragOver(e, node.path, node.isDir)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.path, node.isDir)}
          onDragEnd={handleDragEnd}
          onClick={() => {
            if (node.isDir) {
              toggle(node.path)
            } else {
              if (disableInlineEditor) {
                onInject(node.path)
              } else {
                loadFileContent(node.path)
              }
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, path: node.path, isDir: node.isDir })
          }}
          title={node.path}
        >
          {node.isDir
            ? <IconChevron open={isOpen} />
            : <span className="w-[10px] flex-shrink-0" />
          }
          {node.isDir ? <IconFolder open={isOpen} /> : getFileIcon(node.name)}
          {renamingPath === node.path ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => {
                if (newName && newName !== node.name) {
                  handleRename(node.path, newName)
                } else {
                  setRenamingPath(null)
                  setNewName('')
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (newName && newName !== node.name) {
                    handleRename(node.path, newName)
                  } else {
                    setRenamingPath(null)
                    setNewName('')
                  }
                } else if (e.key === 'Escape') {
                  setRenamingPath(null)
                  setNewName('')
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="flex-1 text-[11px] bg-slate-800 text-slate-200 px-1 py-0.5 rounded outline-none focus:ring-1 focus:ring-indigo-500"
            />
          ) : (
            <span className={`flex-1 text-[11px] truncate transition-colors ${
              isSelected ? 'text-indigo-200' : 'text-slate-400 group-hover:text-slate-200'
            }`}>
              {node.name}
            </span>
          )}
          {!node.isDir && !disableInlineEditor && (
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
        
        {/* Drop indicator line - AFTER */}
        {showAfterLine && (
          <div 
            className="absolute left-0 right-0 h-[2px] bg-cyan-400 z-10"
            style={{ 
              bottom: '-1px',
              marginLeft: `${6 + depth * 14}px`
            }}
          />
        )}
        
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
      {selectedFile && !disableInlineEditor && (
        <div className="w-1/2 border-r border-white/10 flex flex-col">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#141414]">
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
      <div className={`${selectedFile ? 'w-1/2' : 'w-full'} transition-all duration-200 flex flex-col overflow-y-auto custom-scrollbar`}>
        <div className="px-1 py-1">
          {creatingNew && creatingNew.parentPath === cwd && (
            <div className="flex items-center gap-1.5 py-[3px] pr-2 rounded-md mb-1" style={{ paddingLeft: '6px' }}>
              {creatingNew.type === 'folder' ? <IconFolder open={false} /> : <Codicon icon="file" size={14} className="text-slate-400" />}
              <input
                type="text"
                placeholder={creatingNew.type === 'file' ? 'filename.txt' : 'foldername'}
                onBlur={(e) => {
                  const name = e.target.value.trim()
                  if (name) {
                    if (creatingNew.type === 'file') {
                      handleCreateFile(creatingNew.parentPath, name)
                    } else {
                      handleCreateFolder(creatingNew.parentPath, name)
                    }
                  } else {
                    setCreatingNew(null)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const name = (e.target as HTMLInputElement).value.trim()
                    if (name) {
                      if (creatingNew.type === 'file') {
                        handleCreateFile(creatingNew.parentPath, name)
                      } else {
                        handleCreateFolder(creatingNew.parentPath, name)
                      }
                    } else {
                      setCreatingNew(null)
                    }
                  } else if (e.key === 'Escape') {
                    setCreatingNew(null)
                  }
                }}
                autoFocus
                className="flex-1 text-[11px] bg-slate-800 text-slate-200 px-1 py-0.5 rounded outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}
          {tree.map(n => renderNode(n))}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          items={getContextMenuItems(contextMenu.path, contextMenu.isDir || false)}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
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
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#141414]">

      {/* Header */}
      <div className="flex items-center gap-0.5 px-2 pt-2 pb-1.5 border-b border-white/5 shrink-0">
        <button
          onClick={() => setTab('context')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all bg-white/8 text-white`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h12M3 18h8" />
          </svg>
          Context
        </button>
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
      className="absolute top-10 bottom-0 right-0 z-50 animate-in slide-in-from-right duration-200 flex bg-[#141414] border-l border-white/5"
      style={{ width }}
    >
      <div
        onMouseDown={onStartResize}
        className={`w-1 h-full cursor-col-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${isResizing ? 'bg-indigo-500 w-1.5' : 'bg-white/5 hover:bg-indigo-500/50'}`}
      >
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
  zIndex?: number
  width: number
  onStartResize: () => void
}

export const ExplorerPanelOverlay: React.FC<ExplorerPanelOverlayProps> = ({
  cwd, pinnedFiles, onPin, onInject, onAddToInput, onClose, explorerTabPosition, onMoveTo, zIndex = 50, width, onStartResize
}) => {
  return (
    <div
      className={`absolute top-10 bottom-0 right-0 flex flex-col bg-[#141414] border-l border-white/5`}
      style={{ width, zIndex }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={onStartResize}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-100 shrink-0 flex items-center justify-center group bg-transparent hover:bg-indigo-500/50 transition-colors"
      >
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <FileExplorer cwd={cwd} onInject={onInject} onPin={onPin} onAddToInput={onAddToInput} pinnedFiles={pinnedFiles} />
      </div>
    </div>
  )
}
