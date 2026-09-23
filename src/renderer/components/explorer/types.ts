import React from 'react'

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

export type ExplorerPosition = 'panel' | 'iconbar' | 'titlebar'

export interface FileExplorerProps {
  cwd: string
  onInject: (path: string) => void
  onPin: (path: string) => void
  onAddToInput?: (path: string) => void
  onOpenMarkdownPreview?: (path: string) => void
  pinnedFiles: string[]
  disableInlineEditor?: boolean
}

export interface ExplorerTabButtonProps {
  active: boolean
  onClick: () => void
  position: ExplorerPosition
  onMoveTo: (pos: ExplorerPosition) => void
  variant?: ExplorerPosition
}

export interface ExplorerPanelOverlayProps {
  cwd: string
  pinnedFiles: string[]
  onPin: (path: string) => void
  onInject: (path: string) => void
  onAddToInput?: (path: string) => void
  onClose: () => void
  explorerTabPosition: 'iconbar' | 'titlebar'
  onMoveTo: (pos: ExplorerPosition) => void
  zIndex?: number
  width: number
  onStartResize: () => void
}
