import React, { memo } from 'react'
import { FileNode } from './types.js'
import { IconChevron, IconFolder, getFileIcon, IconAt, IconPin } from './FileIcons.js'

export interface FileTreeNodeProps {
  node: FileNode
  depth?: number
  isPinned: boolean
  isOpen: boolean
  isSelected: boolean
  isDragging: boolean
  dropTarget: string | null
  dropPosition: 'before' | 'after' | 'inside' | null
  renamingPath: string | null
  newName: string
  disableInlineEditor: boolean
  onToggle: (path: string) => void
  onSelect: (path: string, isDir: boolean) => void
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void
  onRenameChange: (val: string) => void
  onRenameCommit: (path: string, name: string) => void
  onRenameCancel: () => void
  onDragStart: (e: React.DragEvent, path: string) => void
  onDragOver: (e: React.DragEvent, path: string, isDir: boolean) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, path: string, isDir: boolean) => void
  onDragEnd: () => void
  onInject: (path: string) => void
  onPin: (path: string) => void
  onAddToInput?: (path: string) => void
  renderChildren?: (children: FileNode[], depth: number) => React.ReactNode
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = memo(({
  node,
  depth = 0,
  isPinned,
  isOpen,
  isSelected,
  isDragging,
  dropTarget,
  dropPosition,
  renamingPath,
  newName,
  disableInlineEditor,
  onToggle,
  onSelect,
  onContextMenu,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onInject,
  onPin,
  onAddToInput,
  renderChildren,
}) => {
  const isDropTarget = dropTarget === node.path
  const showBeforeLine = isDropTarget && dropPosition === 'before'
  const showAfterLine = isDropTarget && dropPosition === 'after'
  const showInsideHighlight = isDropTarget && dropPosition === 'inside'
  const isRenaming = renamingPath === node.path

  return (
    <div className="relative">
      {/* Drop indicator line - BEFORE */}
      {showBeforeLine && (
        <div
          className="absolute left-0 right-0 h-[2px] bg-cyan-400 z-10"
          style={{
            top: '-1px',
            marginLeft: `${6 + depth * 14}px`,
          }}
        />
      )}

      <div
        className={`group flex items-center gap-1.5 py-[3px] pr-2 rounded-md cursor-pointer transition-colors ${
          isSelected
            ? 'bg-indigo-500/20 text-indigo-300'
            : isDragging
            ? 'opacity-50'
            : showInsideHighlight
            ? 'bg-cyan-500/20 border border-cyan-500/50'
            : 'hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
        draggable={!renamingPath}
        onDragStart={(e) => onDragStart(e, node.path)}
        onDragOver={(e) => onDragOver(e, node.path, node.isDir)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, node.path, node.isDir)}
        onDragEnd={onDragEnd}
        onClick={() => {
          if (node.isDir) {
            onToggle(node.path)
          } else {
            onSelect(node.path, false)
          }
        }}
        onContextMenu={(e) => onContextMenu(e, node.path, node.isDir)}
        title={node.path}
      >
        {node.isDir ? <IconChevron open={isOpen} /> : <span className="w-[10px] flex-shrink-0" />}
        {node.isDir ? <IconFolder open={isOpen} /> : getFileIcon(node.name)}
        {isRenaming ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={() => {
              if (newName && newName !== node.name) {
                onRenameCommit(node.path, newName)
              } else {
                onRenameCancel()
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (newName && newName !== node.name) {
                  onRenameCommit(node.path, newName)
                } else {
                  onRenameCancel()
                }
              } else if (e.key === 'Escape') {
                onRenameCancel()
              }
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="flex-1 text-[11px] bg-slate-800 text-slate-200 px-1 py-0.5 rounded outline-none focus:ring-1 focus:ring-indigo-500"
          />
        ) : (
          <span
            className={`flex-1 text-[11px] truncate transition-colors ${
              isSelected ? 'text-indigo-200' : 'text-slate-400 group-hover:text-slate-200'
            }`}
          >
            {node.name}
          </span>
        )}
        {!node.isDir && !disableInlineEditor && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onAddToInput && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAddToInput(node.path)
                }}
                className="p-0.5 hover:bg-indigo-500/20 rounded transition-colors"
                title="Add to input"
              >
                <IconAt />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onInject(node.path)
              }}
              className="p-0.5 hover:bg-cyan-500/20 rounded transition-colors"
              title="Inject to context"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-cyan-400"
              >
                <path d="M3 6h18M3 12h12M3 18h8" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPin(node.path)
              }}
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
            marginLeft: `${6 + depth * 14}px`,
          }}
        />
      )}

      {node.isDir && isOpen && node.children && renderChildren && renderChildren(node.children, depth + 1)}
    </div>
  )
})

FileTreeNode.displayName = 'FileTreeNode'
