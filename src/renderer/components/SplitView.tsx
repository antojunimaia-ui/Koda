import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import CompactToolView from './messages/CompactToolView.js'
import { Workspace, AttachedImage, KodaSettings, KodaTheme, Mode } from '../types/index.js'
import MessageRow from './messages/MessageRow.js'
import { BrailleSpinner } from './BrailleSpinner.js'
import { Paperclip, ArrowUpIcon } from 'lucide-react'

interface SplitPanelProps {
  workspace: Workspace
  kodaSettings: KodaSettings
  theme: KodaTheme
  isFocused: boolean
  onFocus: () => void
  onSend: (text: string, images: AttachedImage[], wsId: string) => void
  onRollback: (msgId: number, wsId: string) => void
  onClose: () => void
  handleStop: () => void
  uiMode: 'classic' | 'modern'
}

// ─── Single resizable panel ────────────────────────────────────────────────────
const SplitPanel: React.FC<SplitPanelProps> = ({
  workspace, kodaSettings, theme, isFocused, onFocus, onSend, onRollback, onClose, handleStop, uiMode
}) => {
  const [input, setInput] = useState('')
  const [pendingImages, setPendingImages] = useState<AttachedImage[]>([])
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isProcessing = workspace.isProcessing
  const agentInfo = workspace.agentInfo
  const messages = workspace.messages

  useEffect(() => {
    if (isFocused) textareaRef.current?.focus()
  }, [isFocused])

  useEffect(() => {
    virtuosoRef.current?.scrollToIndex({ index: workspace.messages.length - 1, behavior: 'smooth' })
  }, [workspace.messages.length])

  const adjustHeight = (reset?: boolean) => {
    const textarea = textareaRef.current
    if (!textarea) return
    if (reset) {
      textarea.style.height = uiMode === 'classic' ? 'auto' : '20px'
      return
    }
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }

  const handleSendLocal = () => {
    if (input.trim() && !isProcessing) {
      onSend(input, pendingImages, workspace.id)
      setInput('')
      setPendingImages([])
      adjustHeight(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendLocal()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = () => {
            setPendingImages(prev => [...prev, { 
              dataUrl: reader.result as string, 
              mimeType: file.type, 
              name: file.name || 'pasted.png' 
            }])
          }
          reader.readAsDataURL(file)
        }
      }
    }
  }

  const onFileAttach = () => {
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

  const thinkingLabel = React.useMemo(() => {
    if (!isProcessing) return "";
    const lastMsg = messages[messages.length - 1];
    let label = "Composing...";
    if (lastMsg?.type === 'assistant' && !lastMsg.done) {
      label = "Working...";
    }
    return label;
  }, [messages, isProcessing]);

  const renderableMessages = React.useMemo(() => {
    if (kodaSettings.toolViewMode !== 'compact') return workspace.messages;
    
    const groups: any[] = [];
    let currentToolGroup: any[] = [];
    
    workspace.messages.forEach((msg, idx) => {
      if (msg.type === 'tool') {
        currentToolGroup.push(msg);
      } else {
        if (currentToolGroup.length > 0) {
          groups.push({ type: 'tool_group', tools: [...currentToolGroup], id: `group-${idx}` });
          currentToolGroup = [];
        }
        groups.push(msg);
      }
    });
    
    if (currentToolGroup.length > 0) {
      groups.push({ type: 'tool_group', tools: [...currentToolGroup], id: 'group-last' });
    }
    
    return groups;
  }, [workspace.messages, kodaSettings.toolViewMode]);

  const renderModernInput = () => (
    <div className="px-4 pb-4 pt-2">
      <div className={`relative rounded-2xl border backdrop-blur-xl transition-all shadow-2xl ${isFocused ? 'bg-neutral-900/80 border-neutral-700' : 'bg-neutral-900/40 border-neutral-800 opacity-80'}`}>
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

        <div className="overflow-y-auto max-h-[300px] px-3 pt-2 pb-0">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask Koda anything..."
            className="w-full bg-transparent border-none text-white text-sm focus:outline-none placeholder:text-neutral-500 placeholder:text-sm min-h-[20px] resize-none leading-snug"
            style={{ overflow: "hidden" }}
          />
        </div>

        <div className="flex items-center justify-between px-2 pb-1.5 pt-0 rounded-b-2xl">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={onFileAttach} className="group p-1 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
              <span className="text-[10px] text-zinc-500 hidden group-hover:inline transition-opacity uppercase font-bold tracking-wider">Attach</span>
            </button>
            
            <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-neutral-800 cursor-pointer transition-colors group">
              <span className="text-[9px] font-bold tracking-widest text-zinc-500 group-hover:text-indigo-400">PATH:</span>
              <span className="text-[9px] font-medium text-zinc-400 truncate max-w-[120px] group-hover:text-zinc-200">{agentInfo.cwd}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold tracking-widest text-zinc-600 hidden sm:inline">{agentInfo.provider}</span>
            <button
              type="button"
              onClick={() => isProcessing ? handleStop() : handleSendLocal()}
              disabled={!isProcessing && !input.trim()}
              className={`flex items-center justify-center p-1 rounded-lg transition-all ${
                isProcessing
                  ? 'border border-zinc-400 text-zinc-400 hover:border-white hover:text-white bg-transparent cursor-pointer'
                  : input.trim()
                    ? 'bg-white text-black hover:bg-zinc-200'
                    : 'bg-neutral-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              {isProcessing
                ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
                : <ArrowUpIcon className="w-4 h-4" />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderClassicInput = () => (
    <div className="px-2 pb-2 pt-1 mt-auto">
      <div className={`terminal-input-container items-start transition-all ${isFocused ? 'bg-slate-900/95' : 'bg-slate-900/40 opacity-70'} backdrop-blur-sm z-20 border-t border-white/5`}>
        <span className={`font-bold mt-[6px] ${isProcessing ? 'text-amber-400' : 'text-cyan-400'}`}>❯</span>
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={e => {
            setInput(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isProcessing ? 'Agent is busy...' : 'Type your message...'}
          className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-slate-600 font-bold resize-none py-1.5 leading-normal min-h-[20px] max-h-[200px] custom-scrollbar"
        />
      </div>
    </div>
  )

  return (
    <div
      className={`flex flex-col flex-1 min-w-0 h-full transition-all duration-300 relative ${isFocused ? 'bg-transparent opacity-100' : 'bg-black/40 opacity-40 grayscale-[0.5]'}`}
      onClick={onFocus}
    >
      {/* Panel header */}
      <div
        className={`flex items-center justify-between px-3 h-9 shrink-0 transition-colors border-b border-white/5 ${isFocused ? 'bg-white/5' : 'bg-transparent'}`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isFocused ? (uiMode === 'classic' ? 'bg-cyan-400' : 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)]') : 'bg-zinc-600'}`} />
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.15em] truncate transition-colors ${isFocused ? 'text-white' : 'text-zinc-500'}`}
          >
            {workspace.name}
          </span>
          <span className="text-[9px] tracking-wider truncate max-w-[120px] text-zinc-600 font-medium">
            {workspace.agentInfo?.cwd?.split(/[\\/]/).pop() || ''}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="w-5 h-5 rounded-md flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
          title="Close split view"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Message feed */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Virtuoso
          ref={virtuosoRef}
          data={renderableMessages}
          followOutput="auto"
          className="custom-scrollbar h-full"
          itemContent={(_, item: any) => (
            <div className="px-3 py-1">
              {item.type === 'tool_group' ? (
                <CompactToolView 
                  tools={item.tools} 
                  settings={kodaSettings} 
                  agentInfo={workspace.agentInfo} 
                  uiMode={uiMode} 
                  isLastAndActive={isProcessing && _ === renderableMessages.length - 1}
                />
              ) : (
                <MessageRow
                  msg={item}
                  agentInfo={workspace.agentInfo}
                  kodaSettings={kodaSettings}
                  uiMode={uiMode}
                  onRollback={item.type === 'user' ? () => onRollback(item.id, workspace.id) : undefined}
                />
              )}
            </div>
          )}
          components={{
            Footer: () => (
              <div className="pb-2 px-3">
                {isProcessing && thinkingLabel && (
                  <div className="flex ml-4 items-center gap-3">
                    <BrailleSpinner label={thinkingLabel} color={uiMode === 'classic' ? 'cyan' : 'indigo'} />
                  </div>
                )}
              </div>
            )
          }}
        />
      </div>

      {uiMode === 'modern' ? renderModernInput() : renderClassicInput()}
    </div>
  )
}

interface SplitViewProps {
  workspaces: Workspace[]
  splitIds: [string, string]
  focusedId: string
  onFocus: (id: string) => void
  onCloseSplit: () => void
  onSend: (text: string, images: AttachedImage[], wsId: string) => void
  onRollback: (msgId: number, wsId: string) => void
  kodaSettings: KodaSettings
  theme: KodaTheme
  handleStop: () => void
  uiMode: 'classic' | 'modern'
}

// ─── SplitView: two panels with a draggable divider ──────────────────────────
const SplitView: React.FC<SplitViewProps> = ({
  workspaces, splitIds, focusedId, onFocus, onCloseSplit, onSend, onRollback, kodaSettings, theme, handleStop, uiMode
}) => {
  const [splitRatio, setSplitRatio] = useState(50) // percent for left panel
  const isDraggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const leftWs = workspaces.find(w => w.id === splitIds[0])
  const rightWs = workspaces.find(w => w.id === splitIds[1])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const ratio = ((ev.clientX - rect.left) / rect.width) * 100
      setSplitRatio(Math.max(20, Math.min(80, ratio)))
    }
    const onUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  if (!leftWs || !rightWs) return null

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 w-full overflow-hidden">
      <div style={{ width: `${splitRatio}%` }} className="flex flex-col min-w-0">
        <SplitPanel
          workspace={leftWs}
          kodaSettings={kodaSettings}
          theme={theme}
          isFocused={focusedId === leftWs.id}
          onFocus={() => onFocus(leftWs.id)}
          onSend={onSend}
          onRollback={onRollback}
          onClose={onCloseSplit}
          handleStop={handleStop}
          uiMode={uiMode}
        />
      </div>

      {/* Divider */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1 flex-shrink-0 cursor-col-resize flex items-center justify-center group hover:bg-indigo-500/40 transition-colors z-10"
        style={{ backgroundColor: 'var(--koda-border)' }}
      >
        <div className={`w-px h-12 transition-colors rounded-full ${uiMode === 'classic' ? 'bg-cyan-400/20 group-hover:bg-cyan-400' : 'bg-white/20 group-hover:bg-indigo-400'}`} />
      </div>

      <div style={{ width: `${100 - splitRatio}%` }} className="flex flex-col min-w-0">
        <SplitPanel
          workspace={rightWs}
          kodaSettings={kodaSettings}
          theme={theme}
          isFocused={focusedId === rightWs.id}
          onFocus={() => onFocus(rightWs.id)}
          onSend={onSend}
          onRollback={onRollback}
          onClose={onCloseSplit}
          handleStop={handleStop}
          uiMode={uiMode}
        />
      </div>
    </div>
  )
}

export default SplitView
