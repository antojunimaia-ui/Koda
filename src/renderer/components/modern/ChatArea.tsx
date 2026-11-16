import React, { useCallback } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import type {
  AgentInfo,
  AttachedFile,
  KodaSettings,
  MessageEntry,
  Mode,
  Question,
  QuestionAnswer,
  SlashItem,
} from '../../types/index.js'
import { getIconForFile } from 'vscode-icons-js'
import MessageRow from '../messages/MessageRow.js'
import CompactTurnView from '../messages/CompactTurnView.js'
import UpdateBanner from '../UpdateBanner.js'
import ShellApprovalPanel from '../modals/ShellApprovalPanel.js'
import QuestionsModal from '../modals/QuestionsModal.js'
import { PromptBox } from './PromptBox.js'

export interface ChatAreaProps {
  messages: MessageEntry[]
  isProcessing: boolean
  agentInfo: AgentInfo
  kodaSettings: KodaSettings
  renderableMessages: any[]
  virtuosoRef: React.RefObject<VirtuosoHandle | null>
  showAvatar: boolean
  updateInfo?: { version?: string; downloaded: boolean } | null
  onUpdateDismiss?: () => void
  pendingShell?: { command: string; baseCommand: string } | null
  pendingQuestions?: Question[] | null
  onQuestionsSubmit?: (answers: QuestionAnswer[]) => void
  showSlashMenu: boolean
  slashItems: SlashItem[]
  slashIndex: number
  selectSlashItem: (item: SlashItem) => void
  showSuggestions: boolean
  suggestions: string[]
  suggestionIndex: number
  selectSuggestion: (file: string) => void
  input: string
  handleInputChange: (v: string) => void
  adjustHeight: (reset?: boolean) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  handlePaste: (e: React.ClipboardEvent) => void
  textareaRef: (node: HTMLTextAreaElement | null) => void
  isDraggingOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  pendingImages: AttachedFile[]
  setPendingImages: React.Dispatch<React.SetStateAction<AttachedFile[]>>
  inputFiles: string[]
  onRemoveInputFile: (path: string) => void
  onFileAttach: () => void
  handlePathClick: () => void
  handleStop: () => void
  handleSend: () => void
  renderModelDropdown: () => React.ReactNode
  mode: Mode
  setMode: (m: Mode) => void
  handleRollback: (msgId: number) => void
}

/**
 * Área central de chat do ModernUI — FONTE ÚNICA do layout de mensagens.
 * Usada pelo shell (ModernUI). Os painéis isolados (modo painel) carregam o
 * app inteiro do host, então também bebem desta mesma fonte.
 */
const ChatArea: React.FC<ChatAreaProps> = (props) => {
  const VirtuosoFooter = useCallback(() => {
    return <div className="pb-2" />
  }, [])

  const {
    messages,
    isProcessing,
    agentInfo,
    kodaSettings,
    renderableMessages,
    virtuosoRef,
    showAvatar,
    updateInfo,
    onUpdateDismiss,
    pendingShell,
    pendingQuestions,
    onQuestionsSubmit,
    showSlashMenu,
    slashItems,
    slashIndex,
    selectSlashItem,
    showSuggestions,
    suggestions,
    suggestionIndex,
    selectSuggestion,
    input,
    handleInputChange,
    adjustHeight,
    handleKeyDown,
    handlePaste,
    textareaRef,
    isDraggingOver,
    onDragOver,
    onDragLeave,
    onDrop,
    pendingImages,
    setPendingImages,
    inputFiles,
    onRemoveInputFile,
    onFileAttach,
    handlePathClick,
    handleStop,
    handleSend,
    renderModelDropdown,
    mode,
    setMode,
    handleRollback,
  } = props

  return (
    <div className="flex flex-col flex-1 relative min-h-0">
      {/* Message List — full width so scrollbar sits at window edge */}
      <div className={`min-h-0 ${messages.length === 0 && !isProcessing ? 'hidden' : 'flex-1'} pt-4`}>
        <Virtuoso
          ref={virtuosoRef}
          data={renderableMessages}
          increaseViewportBy={{ top: 200, bottom: 200 }}
          className="custom-scrollbar h-full"
          style={{ scrollbarGutter: 'stable' }}
          itemContent={(index, item: any) => (
            <div className="mb-6 px-4 max-w-5xl mx-auto">
              {item.type === 'turn' ? (
                <CompactTurnView
                  entries={item.entries}
                  settings={kodaSettings}
                  agentInfo={agentInfo}
                  uiMode="modern"
                  isLastAndActive={isProcessing && index === renderableMessages.length - 1}
                />
              ) : (
                <MessageRow
                  msg={item}
                  agentInfo={agentInfo}
                  kodaSettings={kodaSettings}
                  uiMode="modern"
                  onRollback={item.type === 'user' ? () => handleRollback && handleRollback(item.id) : undefined}
                />
              )}
            </div>
          )}
          components={{
            Footer: VirtuosoFooter,
          }}
        />
      </div>

      {/* Loading avatar — outside Virtuoso so it's always visible */}
      {showAvatar && (
        <div className="flex items-center gap-2 max-w-5xl mx-auto w-full px-6 pb-1 animate-in fade-in duration-300">
          <video
            src="/Loading.webm"
            autoPlay
            loop
            muted
            className="w-7 h-7 object-contain"
            style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
          />
          <span className="font-bold text-slate-300 text-sm">Koda</span>
        </div>
      )}

      {/* Input Area */}
      <div
        className={`max-w-5xl mx-auto w-full px-6 pb-6 ${messages.length === 0 && !isProcessing ? 'flex-1 flex flex-col justify-center pt-0' : 'pt-2'}`}
      >
        {updateInfo && onUpdateDismiss && (
          <div className="mb-0">
            <UpdateBanner
              version={updateInfo.version}
              downloaded={updateInfo.downloaded}
              onInstall={() => window.koda.updaterInstall()}
              onDismiss={onUpdateDismiss}
              variant="modern"
            />
          </div>
        )}
        {pendingShell && (
          <div className="mx-4">
            <ShellApprovalPanel
              command={pendingShell.command}
              baseCommand={pendingShell.baseCommand}
              variant="modern"
            />
          </div>
        )}
        {pendingQuestions && pendingQuestions.length > 0 && onQuestionsSubmit && (
          <div className="mx-4">
            <QuestionsModal questions={pendingQuestions} onSubmit={onQuestionsSubmit} />
          </div>
        )}

        {/* Slash Menu — estilo UpdateBanner */}
        {showSlashMenu && slashItems.length > 0 && (
          <div className="mui-popover -mb-4 animate-in fade-in slide-in-from-bottom-1 duration-150">
            <div className="px-2 pt-2 pb-6 max-h-52 overflow-y-auto custom-scrollbar">
              {slashItems.map((item, idx) => (
                <button
                  key={item.name}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left group ${idx === slashIndex ? 'bg-white/5' : 'hover:bg-white/5'}`}
                  onClick={() => selectSlashItem(item)}
                >
                  <span className="text-sm shrink-0">{item.icon}</span>
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-[11px] font-bold tracking-wide ${idx === slashIndex ? 'text-white' : 'text-slate-300 group-hover:text-white'} transition-colors`}
                    >
                      {item.name}
                    </span>
                    {item.description && (
                      <span className="text-[10px] text-slate-600 group-hover:text-slate-500 transition-colors truncate">
                        {item.description}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div className="mui-popover -mb-4 animate-in fade-in slide-in-from-bottom-1 duration-150">
            <div className="px-2 pt-2 pb-6 max-h-52 overflow-y-auto custom-scrollbar">
              {suggestions.map((file, idx) => (
                <button
                  key={file}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left group ${idx === suggestionIndex ? 'bg-white/5' : 'hover:bg-white/5'}`}
                  onClick={() => selectSuggestion(file)}
                >
                  <img
                    src={`https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons/icons/${getIconForFile(file.split(/[/\\]/).pop() || '')}`}
                    width="16"
                    height="16"
                    className="shrink-0 object-contain"
                    alt="file icon"
                  />
                  <span
                    className={`text-[11px] font-bold tracking-wide truncate ${idx === suggestionIndex ? 'text-white' : 'text-slate-300 group-hover:text-white'} transition-colors`}
                  >
                    {file}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <PromptBox
          isDraggingOver={isDraggingOver}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          pendingImages={pendingImages}
          setPendingImages={setPendingImages}
          inputFiles={inputFiles}
          onRemoveInputFile={onRemoveInputFile}
          textareaRef={textareaRef}
          input={input}
          onChange={(e) => {
            handleInputChange(e.target.value)
            adjustHeight()
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFileAttach={onFileAttach}
          handlePathClick={handlePathClick}
          agentInfo={agentInfo}
          isProcessing={isProcessing}
          handleStop={handleStop}
          handleSend={handleSend}
          renderModelDropdown={renderModelDropdown}
          mode={mode}
          onModeChange={setMode}
          variant="normal"
        />
      </div>
    </div>
  )
}

export default ChatArea
