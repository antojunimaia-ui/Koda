import React from 'react'
import { ExplorerPanelOverlayProps } from './types.js'
import { FileExplorer } from './FileExplorer.js'

export const ExplorerPanelOverlay: React.FC<ExplorerPanelOverlayProps> = ({
  cwd,
  pinnedFiles,
  onPin,
  onInject,
  onAddToInput,
  zIndex = 50,
  width,
  onStartResize,
}) => {
  return (
    <div
      className="absolute top-10 bottom-0 right-0 flex flex-col bg-[#141414] border-l border-white/5"
      style={{ width, zIndex }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={onStartResize}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-100 shrink-0 flex items-center justify-center group bg-transparent hover:bg-indigo-500/50 transition-colors"
      />

      {/* File tree */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <FileExplorer
          cwd={cwd}
          onInject={onInject}
          onPin={onPin}
          onAddToInput={onAddToInput}
          pinnedFiles={pinnedFiles}
        />
      </div>
    </div>
  )
}
