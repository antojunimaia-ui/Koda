import React, { useState, useEffect, useCallback } from 'react'
import { FileNode, FileExplorerProps } from './types.js'
import { updateNodeInTree, findNodeInTree, isMarkdown } from './fileTreeUtils.js'
import { FileTreeNode } from './FileTreeNode.js'
import { IconFolder } from './FileIcons.js'
import { ContextMenu, ContextMenuItem } from '../ContextMenu.js'
import { Codicon } from '../Codicon.js'

export const FileExplorer: React.FC<FileExplorerProps> = ({
  cwd,
  onInject,
  onPin,
  onAddToInput,
  onOpenMarkdownPreview,
  pinnedFiles,
  disableInlineEditor = false,
}) => {
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

  const reloadFolder = useCallback((folderPath: string) => {
    const normalPath = folderPath.replace(/\\/g, '/')
    window.koda.listDirLazy(normalPath).then((res: any) => {
      if (res?.success) {
        const childNodes = res.files.map((f: any) => ({
          name: f.name,
          path: f.path,
          isDir: f.isDir,
          children: f.isDir ? [] : undefined,
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
  }, [cwd])

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

    if (isDir) {
      if (mouseY < height * 0.25) {
        setDropPosition('before')
      } else if (mouseY > height * 0.75) {
        setDropPosition('after')
      } else {
        setDropPosition('inside')
      }
    } else {
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

    if (targetPath.startsWith(draggedItem + '/')) {
      setDraggedItem(null)
      setDropTarget(null)
      setDropPosition(null)
      return
    }

    if (dropPosition === 'inside' && isDir) {
      handleMove(draggedItem, targetPath)
    } else if (dropPosition === 'before' || dropPosition === 'after') {
      const targetParent = targetPath.substring(0, targetPath.lastIndexOf('/'))
      const draggedParent = draggedItem.substring(0, draggedItem.lastIndexOf('/'))

      if (targetParent !== draggedParent) {
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

  const getContextMenuItems = (filePath: string, isDir: boolean = false): ContextMenuItem[] => {
    const fileName = filePath.split('/').pop() || ''
    const items: ContextMenuItem[] = []

    if (isDir) {
      items.push({
        id: 'new-file',
        label: 'New File',
        icon: 'new-file',
        onClick: () => {
          setExpanded(prev => new Set(prev).add(filePath))
          setCreatingNew({ type: 'file', parentPath: filePath })
        },
      })
      items.push({
        id: 'new-folder',
        label: 'New Folder',
        icon: 'new-folder',
        onClick: () => {
          setExpanded(prev => new Set(prev).add(filePath))
          setCreatingNew({ type: 'folder', parentPath: filePath })
        },
      })
      items.push({ id: 'sep0', label: '', separator: true })
    }

    if (!isDir) {
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
          },
        })
        items.push({ id: 'sep1', label: '', separator: true })
      }

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
        },
      })

      items.push({
        id: 'inject',
        label: 'Add to Context',
        icon: 'add',
        onClick: () => onInject(filePath),
      })

      if (onAddToInput) {
        items.push({
          id: 'add-input',
          label: 'Add to Input',
          icon: 'mention',
          onClick: () => onAddToInput(filePath),
        })
      }

      items.push({ id: 'sep2', label: '', separator: true })

      const isPinned = pinnedFiles.includes(filePath)
      items.push({
        id: 'pin',
        label: isPinned ? 'Unpin' : 'Pin',
        icon: 'pin',
        onClick: () => onPin(filePath),
      })

      items.push({ id: 'sep3', label: '', separator: true })
    }

    items.push({
      id: 'rename',
      label: 'Rename',
      icon: 'edit',
      keybinding: 'F2',
      onClick: () => {
        setRenamingPath(filePath)
        setNewName(fileName)
      },
    })

    items.push({
      id: 'delete',
      label: 'Delete',
      icon: 'trash',
      keybinding: 'Del',
      onClick: () => {
        if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
          handleDelete(filePath)
        }
      },
    })

    return items
  }

  useEffect(() => {
    if (!cwd || cwd === '...') return
    setLoading(true)
    setLoadedPaths(new Set())
    setExpanded(new Set())
    const normalCwd = cwd.replace(/\\/g, '/')
    window.koda.listDirLazy(normalCwd).then((res: any) => {
      if (res?.success) {
        const rootNodes = res.files.map((f: any) => ({
          name: f.name,
          path: f.path,
          isDir: f.isDir,
          children: f.isDir ? [] : undefined,
        }))
        setTree(rootNodes)
      }
      setLoading(false)
    })
  }, [cwd])

  useEffect(() => {
    const handleEventCreateFile = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setCreatingNew({ type: 'file', parentPath: detail.parentPath || cwd })
    }

    const handleEventCreateFolder = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setCreatingNew({ type: 'folder', parentPath: detail.parentPath || cwd })
    }

    const handleRefresh = () => {
      const normalCwd = cwd.replace(/\\/g, '/')
      reloadFolder(normalCwd)
    }

    window.addEventListener('koda:create-file', handleEventCreateFile)
    window.addEventListener('koda:create-folder', handleEventCreateFolder)
    window.addEventListener('koda:refresh-tree', handleRefresh)

    return () => {
      window.removeEventListener('koda:create-file', handleEventCreateFile)
      window.removeEventListener('koda:create-folder', handleEventCreateFolder)
      window.removeEventListener('koda:refresh-tree', handleRefresh)
    }
  }, [cwd, reloadFolder])

  useEffect(() => {
    if (!cwd || cwd === '...') return

    const unsubscribe = window.koda.onFileSystemChange?.((change: any) => {
      const changedDir = change.directory.replace(/\\/g, '/')
      const normalCwd = cwd.replace(/\\/g, '/')
      if (changedDir === normalCwd || loadedPaths.has(changedDir)) {
        console.log(`[FileExplorer] File system change in ${changedDir}, reloading...`)
        reloadFolder(changedDir)
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [cwd, loadedPaths, reloadFolder])

  const toggle = (path: string) => {
    const normalPath = path.replace(/\\/g, '/')
    const isExpanding = !expanded.has(normalPath)

    if (isExpanding && !loadedPaths.has(normalPath)) {
      window.koda.listDirLazy(normalPath).then((res: any) => {
        if (res?.success) {
          const childNodes = res.files.map((f: any) => ({
            name: f.name,
            path: f.path,
            isDir: f.isDir,
            children: f.isDir ? [] : undefined,
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

  const renderNode = (node: FileNode, depth = 0): React.ReactNode => {
    const isPinned = pinnedFiles.includes(node.path)
    const isOpen = expanded.has(node.path)
    const isSelected = selectedFile === node.path
    const isDragging = draggedItem === node.path

    return (
      <FileTreeNode
        key={node.path}
        node={node}
        depth={depth}
        isPinned={isPinned}
        isOpen={isOpen}
        isSelected={isSelected}
        isDragging={isDragging}
        dropTarget={dropTarget}
        dropPosition={dropPosition}
        renamingPath={renamingPath}
        newName={newName}
        disableInlineEditor={disableInlineEditor}
        onToggle={toggle}
        onSelect={(p) => {
          if (disableInlineEditor) {
            onInject(p)
          } else {
            loadFileContent(p)
          }
        }}
        onContextMenu={(e, p, isDir) => {
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY, path: p, isDir })
        }}
        onRenameChange={setNewName}
        onRenameCommit={handleRename}
        onRenameCancel={() => {
          setRenamingPath(null)
          setNewName('')
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onInject={onInject}
        onPin={onPin}
        onAddToInput={onAddToInput}
        renderChildren={(children, nextDepth) => children.map(c => renderNode(c, nextDepth))}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-slate-600 text-[10px]">Loading...</span>
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-slate-600 text-[10px]">No files found.</span>
      </div>
    )
  }

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
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
