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
  /**
   * Clique na linha do arquivo. Sem esta prop, o clique injeta no contexto
   * (comportamento legado); `null` desliga a ação — a árvore fica só de
   * navegação, como no IDE do Koda.
   */
  onSelectFile?: ((path: string) => void) | null
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
  width: number
  onStartResize: () => void
}
