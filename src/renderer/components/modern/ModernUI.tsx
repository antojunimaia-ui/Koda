import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { 
  Paperclip, 
  ArrowUpIcon,
} from "lucide-react"
import { MessageEntry, AttachedImage, AgentInfo, Mode, KodaTheme } from '../../types/index.js'
import TitleBar from '../TitleBar.js'
import { BrailleSpinner } from '../BrailleSpinner.js'
import MessageRow from '../messages/MessageRow.js'
import BrowserPreview from '../BrowserPreview.js'
import TerminalPanel from '../TerminalPanel.js'

interface ModernUIProps {
  messages: MessageEntry[]
  input: string
  setInput: (val: string) => void
  isProcessing: boolean
  agentInfo: AgentInfo
  mode: Mode
  setMode: (m: Mode) => void
  pendingImages: AttachedImage[]
  setPendingImages: React.Dispatch<React.SetStateAction<AttachedImage[]>>
  handleSend: (overrideText?: string, overrideImages?: AttachedImage[]) => void
  handlePathClick: () => void
  handleInputChange: (val: string) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  virtuosoRef: React.RefObject<VirtuosoHandle | null>
  theme: KodaTheme
  onSettingsClick: () => void
  onMcpClick: () => void
  onBrowserClick: () => void
  showBrowser: boolean
  onTerminalClick: () => void
  showTerminal: boolean
  showPanel: boolean
  onTogglePanel: () => void
  slashItems: import('../../types/index.js').SlashItem[]
  showSlashMenu: boolean
  slashIndex: number
  selectSlashItem: (item: any) => void
  setSlashIndex: React.Dispatch<React.SetStateAction<number>>
  suggestions: string[]
  showSuggestions: boolean
  suggestionIndex: number
  selectSuggestion: (f: string) => void
  setSuggestionIndex: React.Dispatch<React.SetStateAction<number>>
  leftPanelWidth: number
  startResizing: (e: React.MouseEvent) => void
  isResizing: boolean
  browserHeight: number
  isResizingHeight: boolean
  startResizingHeight: (e: React.MouseEvent) => void
}

// ─── Auto Resize Hook ────────────────────────────────────────────────────────
interface UseAutoResizeTextareaProps {
  minHeight: number
  maxHeight?: number
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const localRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = localRef.current
      if (!textarea) return

      if (reset) {
        textarea.style.height = `${minHeight}px`
        return
      }

      textarea.style.height = `${minHeight}px`
      const newHeight = Math.max(
        minHeight,
        Math.min(
          textarea.scrollHeight,
          maxHeight ?? Number.POSITIVE_INFINITY
        )
      )
      textarea.style.height = `${newHeight}px`
    },
    [minHeight, maxHeight]
  )

  useEffect(() => {
    const textarea = localRef.current
    if (textarea) {
      textarea.style.height = `${minHeight}px`
    }
  }, [minHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [adjustHeight])

  return { localRef, adjustHeight }
}

const ModernUI: React.FC<ModernUIProps> = ({
  messages, input, setInput, isProcessing, agentInfo, mode, setMode,
  pendingImages, setPendingImages, handleSend, handlePathClick, handleInputChange,
  inputRef: externalInputRef, virtuosoRef, onSettingsClick, onMcpClick, onBrowserClick,
  showBrowser, onTerminalClick, showTerminal, showPanel, onTogglePanel,
  slashItems, showSlashMenu, slashIndex, selectSlashItem, setSlashIndex,
  suggestions, showSuggestions, suggestionIndex, selectSuggestion, setSuggestionIndex,
  leftPanelWidth, startResizing, isResizing, browserHeight, isResizingHeight, startResizingHeight
}) => {
  
  const { localRef: textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 300,
  })

  // Sync refs: we need both the one from App.tsx (for focus/etc) and the local one for resizing
  useEffect(() => {
    if (externalInputRef && textareaRef.current) {
      (externalInputRef as any).current = textareaRef.current
    }
  }, [externalInputRef, textareaRef])

  const scheduleScroll = () => {
    setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' })
    }, 100)
  }

  useEffect(() => {
    scheduleScroll()
  }, [messages.length])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isProcessing) {
        handleSend()
        adjustHeight(true)
      }
    }
  }

  const onFileAttach = () => {
    // Placeholder for file attachment logic
    const inputChild = document.createElement('input')
    inputChild.type = 'file'
    inputChild.multiple = true
    inputChild.onchange = (e: any) => {
      const files = e.target.files
      if (!files) return
      Array.from(files as FileList).forEach(file => {
        const reader = new FileReader()
        reader.onload = () => {
            setPendingImages(prev => [...prev, { 
                dataUrl: reader.result as string, 
                mimeType: file.type, 
                name: file.name 
            }])
        }
        reader.readAsDataURL(file)
      })
    }
    inputChild.click()
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0b] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-white">
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

      <div className="flex-1 relative flex flex-col min-h-0">
        <div className="flex flex-1 min-h-0 overflow-hidden relative">

          {/* Classic Terminal Look Panels */}
          {(showBrowser || showTerminal) && (
            <>
              <div style={{ width: `${leftPanelWidth}%` }} className="flex flex-col flex-shrink-0 min-w-[250px] relative h-full bg-[#0d1117] border-r border-white/5">
                {showBrowser && (
                  <div className="flex-shrink-0 min-h-[100px] relative" style={{ height: showTerminal ? `${browserHeight}%` : '100%' }}>
                    <BrowserPreview onClose={() => onBrowserClick()} />
                    {(isResizingHeight || isResizing) && <div className={`absolute inset-0 z-[100] ${isResizingHeight ? 'cursor-row-resize' : 'cursor-col-resize'}`} />}
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
                    {(isResizingHeight || isResizing) && <div className={`absolute inset-0 z-[100] ${isResizingHeight ? 'cursor-row-resize' : 'cursor-col-resize'}`} />}
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

          <div
            className="flex flex-col flex-1 relative min-h-0"
            style={{ width: `${100 - (showBrowser || showTerminal ? leftPanelWidth : 0)}%` }}
          >
            <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full relative pt-4">
        {/* Message List */}
        <div className="flex-1 min-h-0 px-4">
          <Virtuoso
            ref={virtuosoRef}
            data={messages}
            followOutput="smooth"
            className="custom-scrollbar pr-2"
            itemContent={(_index, msg) => (
              <div className={`mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <MessageRow 
                  msg={msg} 
                  agentInfo={agentInfo}
                  kodaSettings={{ showTerminal: true } as any} 
                />
              </div>
            )}
            components={{
              Footer: () => (
                <div className="pb-8">
                  {isProcessing && (
                    <div className="flex ml-4 items-center gap-3">
                      <BrailleSpinner label="Koda is composing..." color="indigo" />
                    </div>
                  )}
                </div>
              )
            }}
          />
        </div>

        {/* Vercel v0 Style Input Area */}
        <div className="px-6 pb-6 pt-2">
          <div className="relative bg-neutral-900/80 rounded-2xl border border-neutral-800 shadow-2xl backdrop-blur-xl focus-within:border-neutral-700 transition-all">
            
            {/* Pending images strip */}
            {pendingImages.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 border-b border-white/5">
                {pendingImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={img.dataUrl} className="h-14 w-14 rounded-lg object-cover ring-1 ring-white/10" alt="attached" />
                    <button 
                      onClick={() => setPendingImages(p => p.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center shadow-lg border-2 border-neutral-900"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Slash Menu */}
            {showSlashMenu && slashItems.length > 0 && (
              <div className="absolute bottom-[100%] mb-2 left-0 z-[1100] bg-[#0d1117] border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto w-64 custom-scrollbar p-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
                {slashItems.map((item, idx) => (
                  <button
                    key={item.name}
                    className={`w-full flex flex-col gap-0.5 px-3 py-2 rounded-md transition-all text-left group ${idx === slashIndex ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    onClick={() => selectSlashItem(item)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{item.icon}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${idx === slashIndex ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
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
              <div className="absolute bottom-[100%] mb-2 left-0 z-[1100] bg-[#0d1117] border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto w-64 custom-scrollbar p-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
                {suggestions.map((file, idx) => (
                  <button
                    key={file}
                    className={`w-full flex flex-col px-3 py-2 rounded-md transition-all text-left group ${idx === suggestionIndex ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    onClick={() => selectSuggestion(file)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs">📄</span>
                      <span className={`text-[10px] font-black tracking-widest truncate ${idx === suggestionIndex ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        {file}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-y-auto max-h-[300px] px-3 pt-2 pb-0">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  handleInputChange(e.target.value)
                  adjustHeight()
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask Koda anything..."
                className="w-full bg-transparent border-none text-white text-sm focus:outline-none placeholder:text-neutral-500 placeholder:text-sm min-h-[20px] resize-none leading-snug"
                style={{ overflow: "hidden" }}
              />
            </div>

            <div className="flex items-center justify-between px-2 pb-1.5 pt-0 rounded-b-2xl">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onFileAttach}
                  className="group p-1 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Paperclip className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
                  <span className="text-[10px] text-zinc-500 hidden group-hover:inline transition-opacity uppercase font-bold tracking-wider">
                    Attach
                  </span>
                </button>
                
                <div 
                  onClick={handlePathClick}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-neutral-800 cursor-pointer transition-colors group"
                >
                  <span className="text-[9px] font-bold tracking-widest text-zinc-500 group-hover:text-indigo-400">PATH:</span>
                  <span className="text-[9px] font-medium text-zinc-400 truncate max-w-[300px] group-hover:text-zinc-200">{agentInfo.cwd}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold tracking-widest text-zinc-600 hidden sm:inline">{agentInfo.provider}</span>
                
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isProcessing}
                  className={`
                    flex items-center justify-center p-1 rounded-lg transition-all
                    ${input.trim() && !isProcessing 
                      ? "bg-white text-black hover:bg-zinc-200" 
                      : "bg-neutral-800 text-zinc-600 cursor-not-allowed"}
                  `}
                >
                  <ArrowUpIcon className="w-4 h-4" />
                  <span className="sr-only">Send</span>
                </button>
              </div>
            </div>
          </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModernUI
