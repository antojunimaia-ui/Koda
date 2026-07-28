import React, { useState, useRef, useEffect } from 'react'
import { Paperclip, ArrowUpIcon } from 'lucide-react'
import { getIconForFile } from 'vscode-icons-js'
import { AgentInfo, AttachedFile, Mode } from '../../types/index.js'
import { GitBranchPicker } from './GitBranchPicker.js'

const MODES: { id: Mode; label: string; icon: string; color: string }[] = [
  { id: 'fast',    label: 'Fast',   icon: '⚡', color: 'text-cyan-400' },
  { id: 'planner', label: 'Spec',   icon: '📝', color: 'text-amber-400' },
  { id: 'colab',   label: 'Colab',  icon: '👥', color: 'text-indigo-400' },
  { id: 'teach',   label: 'Teach',  icon: '🎓', color: 'text-emerald-400' },
]

interface PromptBoxProps {
  isDraggingOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  pendingImages: AttachedFile[]
  setPendingImages: React.Dispatch<React.SetStateAction<AttachedFile[]>>
  inputFiles: string[]
  onRemoveInputFile: (path: string) => void
  textareaRef: (node: HTMLTextAreaElement | null) => void
  input: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onFileAttach: () => void
  handlePathClick: () => void
  agentInfo: AgentInfo
  isProcessing: boolean
  handleStop: () => void
  handleSend: () => void
  renderModelDropdown: () => React.ReactNode
  mode?: Mode
  onModeChange?: (m: Mode) => void
  variant?: 'ide' | 'normal'
}

export const PromptBox: React.FC<PromptBoxProps> = ({
  isDraggingOver,
  onDragOver,
  onDragLeave,
  onDrop,
  pendingImages,
  setPendingImages,
  inputFiles,
  onRemoveInputFile,
  textareaRef,
  input,
  onChange,
  onKeyDown,
  onPaste,
  onFileAttach,
  handlePathClick,
  agentInfo,
  isProcessing,
  handleStop,
  handleSend,
  renderModelDropdown,
  mode,
  onModeChange,
  variant = 'normal',
}) => {
  const isIde = variant === 'ide'
  const [showModeMenu, setShowModeMenu] = useState(false)
  const modeMenuRef = useRef<HTMLDivElement>(null)
  const activeMode = MODES.find(m => m.id === mode) ?? MODES[0]

  useEffect(() => {
    if (!showModeMenu) return
    const h = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) setShowModeMenu(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showModeMenu])

  // Extrai só o nome da pasta raiz do projeto para exibição compacta
  const projectName = agentInfo.cwd
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .pop() || agentInfo.cwd

  return (
    <>
      {/* Path label — só no modo normal (não IDE) */}
      {!isIde && (
        <div className="flex items-center mb-1.5 px-1 w-fit">
          <div
            id="tour-cwd"
            onClick={handlePathClick}
            className="flex items-center gap-1.5 cursor-pointer group"
            title={agentInfo.cwd}
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-zinc-600 group-hover:text-indigo-400 transition-colors shrink-0"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-[11px] font-semibold text-zinc-500 group-hover:text-zinc-300 transition-colors truncate max-w-72">
              {projectName}
            </span>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <GitBranchPicker cwd={agentInfo.cwd} />
        </div>
      )}

    <div 
      className={`relative bg-neutral-900/80 rounded-2xl border transition-all ${
        isDraggingOver 
          ? 'border-white bg-white/5' 
          : 'border-neutral-800'
      } backdrop-blur-xl focus-within:border-neutral-700`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {pendingImages.length > 0 && (
        <div className={`flex flex-wrap gap-3 p-3 border-b border-white/5 ${isIde ? '' : 'bg-black/20'}`}>
          {pendingImages.map((img, i) => (
            <div key={i} className="relative group">
              {img.isImage ? (
                <img src={img.dataUrl} className="h-14 w-14 rounded-lg object-cover ring-1 ring-white/10" alt="attached" />
              ) : (
                <div className="h-20 w-32 bg-[#1e1e1e] border border-white/10 rounded-lg p-2.5 flex flex-col justify-between shadow-xl relative overflow-hidden group-hover:border-white/20 transition-all">
                  <div className="text-[10px] text-slate-200 font-bold leading-tight break-all line-clamp-2 pr-1 uppercase tracking-tight">
                    {img.name}
                  </div>
                  <div className="flex items-center">
                    <div className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {img.name.split('.').pop()?.toUpperCase() || 'FILE'}
                    </div>
                  </div>
                  {/* Subtle decorative pattern */}
                  <div className="absolute top-0 right-0 w-12 h-12 bg-white/2 -mr-6 -mt-6 rotate-45 pointer-events-none" />
                </div>
              )}
              <button 
                onClick={() => setPendingImages(p => p.filter((_, idx) => idx !== i))}
                className={`absolute bg-rose-500 text-white text-[9px] rounded-full w-5 h-5 flex items-center justify-center shadow-lg transition-opacity z-10 ${
                  isIde 
                    ? '-top-1.5 -right-1.5 border-2 border-neutral-900' 
                    : '-top-2 -right-2 border-2 border-[#141414] opacity-0 group-hover:opacity-100'
                }`}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-y-auto max-h-75 px-3 pt-2 pb-0 flex flex-wrap items-start gap-1">
        {/* Render file pills inline with text */}
        {inputFiles.map((filePath, i) => {
          const fileName = filePath.split(/[/\\]/).pop() || filePath
          const iconName = getIconForFile(fileName)
          return (
            <div key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#1e1e1e] border border-white/10 rounded text-[11px] font-medium text-slate-300 hover:bg-[#252525] transition-all self-start">
              <img 
                src={`https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons/icons/${iconName}`}
                width="12" 
                height="12" 
                className="shrink-0 object-contain"
                alt={fileName}
              />
              <span className="max-w-37.5 truncate">{fileName}</span>
              <button
                onClick={() => onRemoveInputFile(filePath)}
                className="shrink-0 w-3 h-3 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                title="Remove"
              >
                <svg width="6" height="6" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-slate-400"/>
                </svg>
              </button>
            </div>
          )
        })}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          id="tour-input"
          placeholder={inputFiles.length === 0 ? "Ask Koda anything..." : ""}
          className="flex-1 min-w-50 bg-transparent border-none text-white text-sm focus:outline-none placeholder:text-neutral-500 placeholder:text-sm min-h-5 resize-none leading-snug align-top"
          style={{ overflow: "hidden" }}
        />
      </div>

      <div className="flex items-center justify-between px-2 pb-1.5 pt-0 rounded-b-2xl">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onFileAttach} className="group p-1 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1">
            <Paperclip className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
            <span className="text-[10px] text-zinc-500 hidden group-hover:inline transition-opacity uppercase font-bold tracking-wider">Attach</span>
          </button>
          {renderModelDropdown()}
        </div>

        <div className="flex items-center gap-3">
          {/* Mode selector */}
          {mode && onModeChange && (
            <div className="relative" ref={modeMenuRef}>
              <button
                onClick={() => setShowModeMenu(m => !m)}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-[12px] font-sans transition-colors cursor-pointer"
                title="Switch mode"
              >
                <span>{activeMode.icon} {activeMode.label}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-zinc-500 transition-transform duration-150 ${showModeMenu ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {showModeMenu && (
                <div className="absolute bottom-full right-0 mb-1 w-44 bg-[#0d1117] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-150 z-50">
                  <div className="p-1">
                    {MODES.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { onModeChange(m.id); setShowModeMenu(false) }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-left ${mode === m.id ? 'bg-white/5' : 'hover:bg-white/5'}`}
                      >
                        <span className="text-xs">{m.icon}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${mode === m.id ? m.color : 'text-slate-400'}`}>{m.label}</span>
                        {mode === m.id && <div className={`ml-auto w-1 h-1 rounded-full ${m.color.replace('text-', 'bg-')}`} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => isProcessing ? handleStop() : handleSend()}
            disabled={!isProcessing && !input.trim()}
            className={`flex items-center justify-center p-1 rounded-lg transition-all ${
              isProcessing
                ? 'border border-zinc-400 text-zinc-400 hover:border-white hover:text-white bg-transparent cursor-pointer'
                : input.trim()
                  ? 'bg-white text-black hover:bg-zinc-200'
                  : 'bg-neutral-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            ) : (
              <ArrowUpIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
