import React from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { MessageEntry, AttachedImage, AgentInfo, Mode, KodaTheme, KodaSettings, SlashItem, Workspace } from '../../types/index.js'
import TitleBar from '../TitleBar.js'
import { BrailleSpinner } from '../BrailleSpinner.js'
import MessageRow from '../messages/MessageRow.js'
import BrowserPreview from '../BrowserPreview.js'
import TerminalPanel from '../TerminalPanel.js'
import WorkspaceTabs from '../WorkspaceTabs.js'

interface ClassicUIProps {
  messages: MessageEntry[]
  input: string
  setInput: (val: string) => void
  initializing: boolean
  isProcessing: boolean
  agentInfo: AgentInfo
  mode: Mode
  setMode: (m: Mode) => void
  pendingImages: AttachedImage[]
  setPendingImages: (imgs: AttachedImage[] | ((p: AttachedImage[]) => AttachedImage[])) => void
  taskQueue: { text: string; images: AttachedImage[] }[]
  setTaskQueue: (queue: { text: string; images: AttachedImage[] }[] | ((p: { text: string; images: AttachedImage[] }[]) => { text: string; images: AttachedImage[] }[])) => void
  handleSend: (overrideText?: string, overrideImages?: AttachedImage[]) => void
  handlePathClick: () => void
  handleInputChange: (val: string) => void
  handleRollback: (msgId: number) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  virtuosoRef: React.RefObject<VirtuosoHandle | null>
  theme: KodaTheme
  kodaSettings: KodaSettings
  onSettingsClick: () => void
  onMcpClick: () => void
  onBrowserClick: () => void
  showBrowser: boolean
  onTerminalClick: () => void
  showTerminal: boolean
  showPanel: boolean
  onTogglePanel: () => void
  leftPanelWidth: number
  rightPanelWidth: number
  startResizing: (e: React.MouseEvent) => void
  isResizing: boolean
  startResizingRight: (e: React.MouseEvent) => void
  isResizingRight: boolean
  browserHeight: number
  isResizingHeight: boolean
  startResizingHeight: (e: React.MouseEvent) => void
  isDragging: boolean
  handleDragOver: (e: any) => void
  handleDragLeave: (e: any) => void
  handleDrop: (e: any) => void
  inPlanMode: boolean
  showThinkingSpinner: boolean
  symbols: any
  slashItems: SlashItem[]
  showSlashMenu: boolean
  slashIndex: number
  selectSlashItem: (item: any) => void
  setSlashIndex: React.Dispatch<React.SetStateAction<number>>
  suggestions: string[]
  showSuggestions: boolean
  suggestionIndex: number
  selectSuggestion: (f: string) => void
  setSuggestionIndex: React.Dispatch<React.SetStateAction<number>>
  
  // Workspace Split
  isSplitEnabled: boolean
  onToggleSplit: () => void
  workspaces: Workspace[]
  activeId: string | null
  setActiveId: (id: string) => void
  onAddWorkspace: () => void
  onCloseWorkspace: (id: string) => void
}

const ClassicUI: React.FC<ClassicUIProps> = ({
  messages, input, setInput, initializing, isProcessing, agentInfo, mode, setMode,
  pendingImages, setPendingImages, taskQueue, setTaskQueue, handleSend, handlePathClick, 
  handleInputChange, handleRollback, inputRef, virtuosoRef, theme, kodaSettings,
  onSettingsClick, onMcpClick, onBrowserClick, showBrowser, onTerminalClick, 
  showTerminal, showPanel, onTogglePanel, leftPanelWidth, rightPanelWidth, startResizing, isResizing,
  startResizingRight, isResizingRight, browserHeight, isResizingHeight, startResizingHeight,
  isDragging, handleDragOver, handleDragLeave, handleDrop, inPlanMode, showThinkingSpinner,
  symbols, slashItems, showSlashMenu, slashIndex, selectSlashItem, setSlashIndex,
  suggestions, showSuggestions, suggestionIndex, selectSuggestion, setSuggestionIndex,
  isSplitEnabled, onToggleSplit, workspaces, activeId, setActiveId, onAddWorkspace, onCloseWorkspace
}) => {
  
  const showLeft = (showBrowser && kodaSettings.browserPosition === 'left') || (showTerminal && kodaSettings.terminalPosition === 'left');
  const showRight = (showBrowser && kodaSettings.browserPosition === 'right') || (showTerminal && kodaSettings.terminalPosition === 'right');

  const renderPanelStack = (pos: 'left' | 'right') => {
    const hasBrowser = showBrowser && kodaSettings.browserPosition === pos;
    const hasTerminal = showTerminal && kodaSettings.terminalPosition === pos;
    if (!hasBrowser && !hasTerminal) return null;

    return (
      <div 
        style={{ width: pos === 'left' ? `${leftPanelWidth}%` : `${rightPanelWidth}%` }} 
        className={`flex flex-col flex-shrink-0 min-w-[250px] relative h-full bg-[#0d1117] ${pos === 'left' ? 'border-r' : 'border-l'} border-white/5`}
      >
        {hasBrowser && (
          <div className="flex-shrink-0 min-h-[100px] relative" style={{ height: hasTerminal ? `${browserHeight}%` : '100%' }}>
            <BrowserPreview onClose={() => onBrowserClick()} />
            {(isResizingHeight || isResizing || isResizingRight) && (
              <div className={`absolute inset-0 z-[100] ${isResizingHeight ? 'cursor-row-resize' : 'cursor-col-resize'}`} />
            )}
          </div>
        )}
        {hasBrowser && hasTerminal && (
          <div
            onMouseDown={startResizingHeight}
            className={`h-1 w-full cursor-row-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${isResizingHeight ? 'bg-cyan-500 h-1.5' : 'bg-white/5 hover:bg-cyan-500/50'}`}
          >
            <div className={`w-8 h-[1px] bg-white/20 group-hover:bg-white/50 transition-colors ${isResizingHeight ? 'bg-white' : ''}`} />
          </div>
        )}
        {hasTerminal && (
          <div className="flex-1 min-h-[100px] relative" style={{ height: hasBrowser ? `${100 - browserHeight}%` : '100%' }}>
            <TerminalPanel onClose={() => onTerminalClick()} cwd={agentInfo.cwd} workspaceId={activeId || undefined} />
            {(isResizingHeight || isResizing || isResizingRight) && (
              <div className={`absolute inset-0 z-[100] ${isResizingHeight ? 'cursor-row-resize' : 'cursor-col-resize'}`} />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex flex-col h-screen bg-slate-900 overflow-hidden text-slate-300 selection:bg-cyan-900 selection:text-white relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-[100] border-2 border-dashed border-cyan-400/60 bg-cyan-900/20 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-2">📂</div>
            <div className="text-cyan-300 font-bold text-lg">Drop files or images here</div>
            <div className="text-slate-400 text-sm mt-1">Images will be attached • Code files will be @mentioned</div>
          </div>
        </div>
      )}

      <TitleBar
        mode={mode}
        onModeChange={setMode}
        onSettingsClick={onSettingsClick}
        onMcpClick={onMcpClick}
        onBrowserClick={onBrowserClick}
        showBrowser={showBrowser}
        onTerminalClick={onTerminalClick}
        showTerminal={showTerminal}
        showPanel={showPanel}
        onTogglePanel={onTogglePanel}
        uiMode="classic"
        isSplitEnabled={isSplitEnabled}
        onToggleSplit={onToggleSplit}
      />

      {isSplitEnabled && (
        <WorkspaceTabs 
          workspaces={workspaces}
          activeId={activeId}
          onSwitch={setActiveId}
          onAdd={onAddWorkspace}
          onClose={onCloseWorkspace}
        />
      )}

      <div className="flex-1 relative flex flex-col min-h-0">
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          
          {/* Left Area */}
          {showLeft && renderPanelStack('left')}
          {showLeft && (
            <div
              onMouseDown={startResizing}
              className={`w-1 h-full cursor-col-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${isResizing ? 'w-1.5' : 'bg-white/5 hover:bg-white/10'}`}
              style={{ backgroundColor: isResizing ? 'var(--koda-accent)' : undefined }}
            >
              <div className={`w-[1px] h-8 bg-white/20 group-hover:bg-white/50 transition-colors ${isResizing ? 'bg-white' : ''}`} />
            </div>
          )}

          {/* Chat Panel */}
          <div className="flex flex-col flex-1 px-2 py-4 overflow-hidden relative min-w-0">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
              <pre className="text-slate-500/10 text-[11px] md:text-sm lg:text-base leading-[1.1] select-none font-mono text-center filter blur-[0.2px] opacity-80">
                {`:::    :::  ::::::::  :::::::::      :::
:+:   :+:  :+:    :+: :+:    :+:   :+: :+:
+:+  +:+   +:+    +:+ +:+    +:+  +:+   +:+
+#++:++    +#+    +:+ +#+    +:+ +#++:++#++:
+#+  +#+   +#+    +#+ +#+    +#+ +#+     +#+
#+#   #+#  #+#    #+# #+#    #+# #+#     #+#
###    ###  ########  #########  ###     ###`}
              </pre>
            </div>

            {/* Header */}
            <div className="terminal-header uppercase tracking-wider relative z-10">
              <div className="terminal-box flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold">
                  <span style={{ color: 'var(--koda-text-dim)' }}>Project: <span style={{ color: 'var(--koda-status-busy)' }}>{agentInfo.project}</span></span>
                  <div className="flex items-center gap-3">
                    <span className="opacity-80 text-[9px]" style={{ color: 'var(--koda-status-ok)' }}>{agentInfo.model}</span>
                    <div 
                      className="flex items-center gap-1.5 pl-2 border-l border-white/5"
                      style={{ 
                        color: initializing ? 'var(--koda-text-dim)' : isProcessing ? 'var(--koda-status-busy)' : 'var(--koda-status-ok)' 
                      }}
                    >
                      {inPlanMode && (
                        <span className="flex items-center gap-1 mr-1 font-bold uppercase text-[9px] tracking-widest" style={{ color: 'var(--koda-status-busy)' }}>
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--koda-status-busy)' }}></span>
                        </span>
                      )}
                      <span className="text-[10px]">{initializing || isProcessing ? symbols.circle : symbols.bullet}</span>
                      <span className="text-[10px] font-black tracking-tighter">
                        {initializing ? 'Loading...' : isProcessing ? 'Busy' : 'Ready'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div
                onClick={handlePathClick}
                className="flex items-center gap-2 text-[10px] font-mono cursor-pointer transition-all group mt-1"
                style={{ color: 'var(--koda-text-dim)' }}
                title="Click to select new working directory"
              >
                <span className="opacity-40 group-hover:opacity-100 transition-all" style={{ color: 'var(--koda-accent)' }}>{symbols.dir}</span>
                <span className="truncate max-w-[300px] transition-all group-hover:text-white">{agentInfo.cwd}</span>
              </div>
            </div>

            {/* Message list */}
            <div className="flex-1 min-h-0 relative mt-2 pr-2">
              <Virtuoso
                ref={virtuosoRef}
                data={messages}
                followOutput="auto"
                className="terminal-scroll-area h-full custom-scrollbar"
                itemContent={(_index, msg) => (
                  <MessageRow
                    key={msg.id}
                    msg={msg}
                    onRollback={msg.type === 'user' ? () => handleRollback(msg.id) : undefined}
                    kodaSettings={kodaSettings}
                    agentInfo={agentInfo}
                    uiMode="classic"
                  />
                )}
                components={{
                  Footer: () => (
                    <div className="pb-4">
                      {showThinkingSpinner && (
                        <div className="flex flex-col ml-4 mt-3">
                          <BrailleSpinner rotateLabel color="cyan" />
                        </div>
                      )}
                    </div>
                  )
                }}
              />
            </div>

            {/* Input area */}
            <div className="mt-auto">
              {pendingImages.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 mb-1 pt-1">
                  {pendingImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img.dataUrl} alt={img.name} className="h-16 rounded border border-slate-700 object-cover" />
                      <button
                        onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              {taskQueue.length > 0 && (
                <div className="flex items-center gap-2 px-3 mb-1 py-1 border-t border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">⏳ Queue</span>
                  <div className="flex gap-1.5 flex-1 overflow-hidden">
                    {taskQueue.map((t, i) => (
                      <span key={i} className="text-[10px] text-slate-500 font-mono bg-slate-800/60 rounded px-2 py-0.5 truncate max-w-[160px]">{t.text}</span>
                    ))}
                  </div>
                  <button onClick={() => setTaskQueue([])} className="text-[9px] text-slate-600 hover:text-rose-400 transition-colors" title="Clear queue">✕ clear</button>
                </div>
              )}

              <div className="relative w-full mt-2">
                {/* Slash Menu */}
                {showSlashMenu && slashItems.length > 0 && (
                  <div className="absolute bottom-[100%] left-4 z-[1100] bg-[#0d1117] border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto w-64 custom-scrollbar mb-2 p-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
                    {slashItems.map((item, idx) => (
                      <button
                        key={item.name}
                        className={`w-full flex flex-col gap-0.5 px-3 py-2 rounded-md transition-all text-left group ${idx === slashIndex ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        onClick={() => selectSlashItem(item)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{item.icon}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${idx === slashIndex ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                              {item.name}
                            </span>
                          </div>
                        </div>
                        {item.description && (
                          <span className="text-[9px] text-slate-500 ml-5 group-hover:text-slate-400 transition-colors uppercase font-medium">
                            {item.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Suggestions Menu */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute bottom-[100%] left-4 z-[1100] bg-[#0d1117] border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto w-64 custom-scrollbar mb-2 p-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
                    {suggestions.map((file, idx) => (
                      <button
                        key={file}
                        className={`w-full flex flex-col px-3 py-2 rounded-md transition-all text-left group ${idx === suggestionIndex ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        onClick={() => selectSuggestion(file)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs">📄</span>
                          <span className={`text-[10px] font-black tracking-widest truncate ${idx === suggestionIndex ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                            {file}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Input Container */}
                <div className={`terminal-input-container items-start bg-slate-900/95 backdrop-blur-sm z-20 ${initializing ? 'terminal-input-disabled' : ''}`}>
                  <span className={`font-bold mt-[6px] ${initializing ? 'text-slate-600' : isProcessing ? 'text-amber-400' : 'text-cyan'}`}>{symbols.arrow}</span>
                  {initializing ? (
                    <span className="text-slate-600 animate-pulse italic text-sm">Initializing...</span>
                  ) : (
                  <textarea
                    ref={inputRef}
                    autoFocus
                    rows={1}
                    value={input}
                    onChange={e => {
                      handleInputChange(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = `${e.target.scrollHeight}px`
                    }}
                    onKeyDown={e => {
                      if (showSlashMenu) {
                        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (slashItems[slashIndex]) selectSlashItem(slashItems[slashIndex]) }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((prev: number) => (prev > 0 ? prev - 1 : slashItems.length - 1)) }
                        else if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((prev: number) => (prev < slashItems.length - 1 ? prev + 1 : 0)) }
                        else if (e.key === 'Escape') setSlashIndex(-1)
                        return
                      }
                      if (showSuggestions) {
                        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (suggestions[suggestionIndex]) selectSuggestion(suggestions[suggestionIndex]) }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIndex((prev: number) => (prev > 0 ? prev - 1 : suggestions.length - 1)) }
                        else if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIndex((prev: number) => (prev < suggestions.length - 1 ? prev + 1 : 0)) }
                        else if (e.key === 'Escape') setSuggestionIndex(-1)
                        return
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                        if (inputRef.current) inputRef.current.style.height = 'auto'
                      }
                    }}
                    placeholder={isProcessing ? 'Add to queue — agent will run next...' : 'Type your message...'}
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-slate-600 font-bold resize-none py-1.5 leading-normal min-h-[20px] max-h-[200px] custom-scrollbar"
                  />
                )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Area */}
          {showRight && (
            <div
              onMouseDown={startResizingRight}
              className={`w-1 h-full cursor-col-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${isResizingRight ? 'bg-cyan-500 w-1.5' : 'bg-white/5 hover:bg-cyan-500/50'}`}
            >
              <div className={`w-[1px] h-8 bg-white/20 group-hover:bg-white/50 transition-colors ${isResizingRight ? 'bg-white' : ''}`} />
            </div>
          )}
          {showRight && renderPanelStack('right')}

          {/* Space for ContextPanel overlay */}
          {showPanel && <div className="w-64 flex-shrink-0" />}
        </div>
      </div>
    </div>
  )
}

export default ClassicUI
