import React from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { MessageEntry, AttachedImage, AgentInfo, Mode, KodaTheme, KodaSettings, TrackedFile, SlashItem } from '../../types/index.js'
import TitleBar from '../TitleBar.js'
import { BrailleSpinner } from '../BrailleSpinner.js'
import MessageRow from '../messages/MessageRow.js'
import BrowserPreview from '../BrowserPreview.js'
import TerminalPanel from '../TerminalPanel.js'

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
  setPendingImages: React.Dispatch<React.SetStateAction<AttachedImage[]>>
  taskQueue: { text: string; images: AttachedImage[] }[]
  setTaskQueue: React.Dispatch<React.SetStateAction<{ text: string; images: AttachedImage[] }[]>>
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
  startResizing: (e: React.MouseEvent) => void
  isResizing: boolean
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
}

const ClassicUI: React.FC<ClassicUIProps> = ({
  messages, input, setInput, initializing, isProcessing, agentInfo, mode, setMode,
  pendingImages, setPendingImages, taskQueue, setTaskQueue, handleSend, handlePathClick, 
  handleInputChange, handleRollback, inputRef, virtuosoRef, theme, kodaSettings,
  onSettingsClick, onMcpClick, onBrowserClick, showBrowser, onTerminalClick, 
  showTerminal, showPanel, onTogglePanel, leftPanelWidth, startResizing, isResizing,
  browserHeight, isResizingHeight, startResizingHeight,
  isDragging, handleDragOver, handleDragLeave, handleDrop, inPlanMode, showThinkingSpinner,
  symbols, slashItems, showSlashMenu, slashIndex, selectSlashItem, setSlashIndex,
  suggestions, showSuggestions, suggestionIndex, selectSuggestion, setSuggestionIndex
}) => {
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
      />

      {/* Main Container below TitleBar */}
      <div className="flex-1 relative flex flex-col min-h-0">
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* Classic Terminal Look Panels */}
          {(showBrowser || showTerminal) && (
            <>
              {/* Note: Left panel logic stays in App.tsx or pass more props if needed */}
              <div style={{ width: `${leftPanelWidth}%` }} className="flex flex-col flex-shrink-0 min-w-[250px] relative h-full bg-[#0d1117]">
                {showBrowser && (
                  <div className="flex-shrink-0 min-h-[100px] relative" style={{ height: showTerminal ? `${browserHeight}%` : '100%' }}>
                    <BrowserPreview onClose={() => onBrowserClick()} />
                    {isResizingHeight && <div className="absolute inset-0 z-[100] cursor-row-resize" />}
                  </div>
                )}
                {showBrowser && showTerminal && (
                  <div
                    onMouseDown={startResizingHeight}
                    className={`h-1 w-full cursor-row-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${isResizingHeight ? 'bg-indigo-500 h-1.5' : 'bg-white/5 hover:bg-indigo-500/50'}`}
                  >
                    <div className={`w-8 h-[1px] bg-white/20 group-hover:bg-white/50 transition-colors ${isResizingHeight ? 'bg-white' : ''}`} />
                  </div>
                )}
                {showTerminal && (
                  <div className="flex-1 min-h-[100px] relative" style={{ height: showBrowser ? `${100 - browserHeight}%` : '100%' }}>
                    <TerminalPanel onClose={() => onTerminalClick()} cwd={agentInfo.cwd} />
                    {isResizingHeight && <div className="absolute inset-0 z-[100] cursor-row-resize" />}
                  </div>
                )}
              </div>
              <div
                onMouseDown={startResizing}
                className={`w-1 h-full cursor-col-resize transition-all z-[100] flex-shrink-0 flex items-center justify-center group ${isResizing ? 'bg-indigo-500 w-1.5' : 'bg-white/5 hover:bg-indigo-500/50'}`}
              >
                <div className={`w-[1px] h-8 bg-white/20 group-hover:bg-white/50 transition-colors ${isResizing ? 'bg-white' : ''}`} />
              </div>
            </>
          )}

          {/* Chat panel */}
          <div
            className="flex flex-col flex-1 px-2 py-4 overflow-hidden relative"
            style={{ width: `${100 - (showBrowser || showTerminal ? leftPanelWidth : 0)}%` }}
          >
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
            <div className="terminal-header uppercase tracking-wider">
              <div className="terminal-box flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-bold">
                  <span className="text-slate-400">Project: <span className="text-yellow">{agentInfo.project}</span></span>
                  <div className="flex items-center gap-3">
                    <span className="text-green opacity-80 text-[9px]">{agentInfo.model}</span>
                    <div className={`flex items-center gap-1.5 pl-2 border-l border-white/5 ${initializing ? 'text-slate-500' : isProcessing ? 'text-yellow' : 'text-green'}`}>
                      {inPlanMode && (
                        <span className="flex items-center gap-1 mr-1 text-yellow-400 font-bold uppercase text-[9px] tracking-widest">
                          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
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
                className="flex items-center gap-2 text-[10px] text-slate-500 font-mono cursor-pointer transition-all group mt-1"
                title="Click to select new working directory"
              >
                <span className="opacity-40 group-hover:text-cyan group-hover:opacity-100 transition-all">{symbols.dir}</span>
                <span className="text-slate-500 group-hover:text-slate-300 truncate max-w-[300px] transition-all">{agentInfo.cwd}</span>
              </div>
            </div>

            {/* Message area */}
            <div className="flex-1 min-h-0 relative mt-2 pr-2">
              <Virtuoso
                ref={virtuosoRef}
                data={messages}
                followOutput="smooth"
                className="terminal-scroll-area h-full custom-scrollbar"
                itemContent={(_index, msg) => (
                  <MessageRow
                    key={msg.id}
                    msg={msg}
                    onRollback={msg.type === 'user' ? () => handleRollback(msg.id) : undefined}
                    kodaSettings={kodaSettings}
                    agentInfo={agentInfo}
                  />
                )}
                components={{
                  Footer: () => (
                    <div className="pb-4">
                      {showThinkingSpinner && (
                        <div className="flex flex-col ml-4 mt-3">
                          <BrailleSpinner label="Thinking..." color="cyan" />
                        </div>
                      )}
                    </div>
                  )
                }}
              />
            </div>

            {/* Pending images strip */}
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

            {/* Task Queue indicator */}
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

            {/* Input Area Wrapper */}
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

              {/* Input */}
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
                      else if (e.key === 'Escape') setSlashIndex(-1) // Hidden
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
      </div>
    </div>
  )
}

export default ClassicUI
