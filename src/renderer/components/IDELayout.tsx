import React, { useEffect, useRef, useState } from 'react'
import { FileExplorer } from './context/ContextPanel.js'
import { Codicon } from './Codicon.js'
import BrowserPreview from './BrowserPreview.js'
import TerminalPanel from './TerminalPanel.js'
import SourceControlPanel from './SourceControlPanel.js'

/**
 * Shell do IDE do Koda.
 *
 * O centro não é o editor — não existe editor de arquivos. São quatro
 * superfícies, cada uma com um papel:
 *
 *   ┌───────────────┬──────────────────────────────┐
 *   │  Files        │  Agente (chat)               │
 *   ├───────────────┼──────────────────────────────┤
 *   │  Changes      │  Terminal │ Preview          │
 *   └───────────────┴──────────────────────────────┘
 *
 * A árvore de arquivos é navegação: clicar não abre nada; ela serve para
 * localizar o projeto, arrastar arquivos para o chat e alimentar o contexto.
 * Código aparece no app como diff (Changes) ou como bloco no chat.
 */
interface IDELayoutProps {
  // Files
  showExplorerPanel: boolean
  cwd: string
  pinnedFiles: string[]
  onPin: (path: string) => void
  onInject: (path: string) => void
  onAddToInput: (path: string) => void

  // Terminal / Preview
  showBrowser?: boolean
  showTerminal?: boolean
  onBrowserClose?: () => void
  onTerminalClose?: () => void

  // Chat (superfície principal, ocupa o quadrante superior direito)
  children: React.ReactNode
}

type BottomTab = 'terminal' | 'preview'

/** Arrasta uma coluna/linha e devolve o deslocamento em pixels. */
const startDrag =
  (onStart: (event: React.MouseEvent) => ((event: MouseEvent) => void) | null) => (event: React.MouseEvent) => {
    event.preventDefault()
    const onMove = onStart(event)
    if (!onMove) return
    const handleMouseMove = (moveEvent: MouseEvent) => onMove(moveEvent)
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = getComputedStyle(event.currentTarget as HTMLElement).cursor
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

const IDELayout: React.FC<IDELayoutProps> = ({
  showExplorerPanel,
  cwd,
  pinnedFiles,
  onPin,
  onInject,
  onAddToInput,
  showBrowser = false,
  showTerminal = false,
  onBrowserClose,
  onTerminalClose,
  children,
}) => {
  const [leftWidth, setLeftWidth] = useState(300)
  const [filesRatio, setFilesRatio] = useState(0.55)
  const [bottomRatio, setBottomRatio] = useState(0.38)
  const [bottomTab, setBottomTab] = useState<BottomTab>(showTerminal ? 'terminal' : 'preview')

  const rightColumnRef = useRef<HTMLDivElement | null>(null)
  const leftColumnRef = useRef<HTMLElement | null>(null)

  const hasBottomPanel = showTerminal || showBrowser

  // A aba ativa precisa existir: terminal e preview entram/saem por atalho.
  useEffect(() => {
    if (bottomTab === 'terminal' && !showTerminal) setBottomTab('preview')
    if (bottomTab === 'preview' && !showBrowser) setBottomTab('terminal')
  }, [showTerminal, showBrowser, bottomTab])

  // Sem limites fixos: a coluna vai de 0 até a largura disponível, e o painel
  // inferior de 0 até 100% da coluna direita.
  const handleLeftResize = startDrag((event) => {
    const startX = event.clientX
    const startWidth = leftWidth
    const available = leftColumnRef.current?.parentElement?.clientWidth ?? window.innerWidth
    return (moveEvent) => {
      setLeftWidth(Math.max(0, Math.min(available, startWidth + moveEvent.clientX - startX)))
    }
  })

  const handleBottomResize = startDrag(() => {
    const rect = rightColumnRef.current?.getBoundingClientRect()
    if (!rect || rect.height === 0) return null
    return (moveEvent) => {
      const height = rect.height - (moveEvent.clientY - rect.top)
      setBottomRatio(Math.max(0, Math.min(1, height / rect.height)))
    }
  })

  // Divisor Files ↔ Changes, também sem limites (0 a 100% da coluna).
  const handleFilesResize = startDrag(() => {
    const rect = leftColumnRef.current?.getBoundingClientRect()
    if (!rect || rect.height === 0) return null
    return (moveEvent) => {
      setFilesRatio(Math.max(0, Math.min(1, (moveEvent.clientY - rect.top) / rect.height)))
    }
  })

  return (
    <div className="flex h-full min-h-0">
      {/* ── Coluna esquerda: Files / Changes ────────────────────────────── */}
      <aside
        ref={leftColumnRef}
        className="shrink-0 flex flex-col min-h-0 mui-hairline-r"
        style={{ width: `${leftWidth}px` }}
        aria-label="Files and changes"
      >
        {showExplorerPanel && (
          <section className="flex flex-col min-h-0 overflow-hidden" style={{ flex: `${filesRatio} 1 0%` }}>
            <div className="mui-hairline-b flex items-center justify-between px-3 h-8 shrink-0">
              <span className="mui-eyebrow">Files</span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('koda:create-file', { detail: { parentPath: cwd } }))
                  }
                  className="p-0.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded transition-colors"
                  title="New File"
                >
                  <Codicon icon="new-file" size={14} />
                </button>
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('koda:create-folder', { detail: { parentPath: cwd } }))
                  }
                  className="p-0.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded transition-colors"
                  title="New Folder"
                >
                  <Codicon icon="new-folder" size={14} />
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('koda:refresh-tree'))}
                  className="p-0.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded transition-colors"
                  title="Refresh"
                >
                  <Codicon icon="refresh" size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 pt-1">
              <FileExplorer
                cwd={cwd}
                onInject={onInject}
                onPin={onPin}
                onAddToInput={onAddToInput}
                pinnedFiles={pinnedFiles}
                disableInlineEditor={true}
                // Árvore é só navegação: clique na linha não abre nem injeta nada.
                onSelectFile={null}
              />
            </div>
          </section>
        )}

        {/* Divisor arrastável Files ↔ Changes */}
        {showExplorerPanel && (
          <div
            onMouseDown={handleFilesResize}
            className="h-1 shrink-0 cursor-row-resize transition-all z-raised bg-white/5 hover:bg-indigo-500/50"
            role="separator"
            aria-orientation="horizontal"
          />
        )}

        <section
          className="flex flex-col min-h-0 overflow-hidden"
          style={{ flex: showExplorerPanel ? `${1 - filesRatio} 1 0%` : '1 1 0%' }}
        >
          <SourceControlPanel cwd={cwd} embedded />
        </section>
      </aside>

      <div
        onMouseDown={handleLeftResize}
        className="w-1 cursor-col-resize shrink-0 transition-all z-raised bg-transparent hover:bg-indigo-500/50"
        role="separator"
        aria-orientation="vertical"
      />

      {/* ── Coluna direita: Agente / Terminal|Preview ───────────────────── */}
      <div ref={rightColumnRef} className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 relative overflow-hidden">{children}</div>

        {hasBottomPanel && (
          <>
            <div
              onMouseDown={handleBottomResize}
              className="h-1 cursor-row-resize shrink-0 transition-all z-raised bg-white/5 hover:bg-indigo-500/50"
              role="separator"
              aria-orientation="horizontal"
            />
            <section
              className="shrink-0 flex flex-col min-h-0 mui-hairline-t"
              style={{ height: `${bottomRatio * 100}%` }}
            >
              <div className="mui-hairline-b flex items-center gap-1 px-2 h-8 shrink-0">
                {showTerminal && (
                  <button
                    onClick={() => setBottomTab('terminal')}
                    className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${
                      bottomTab === 'terminal'
                        ? 'bg-white/10 text-slate-100 ring-1 ring-white/15'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    Terminal
                  </button>
                )}
                {showBrowser && (
                  <button
                    onClick={() => setBottomTab('preview')}
                    className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${
                      bottomTab === 'preview'
                        ? 'bg-white/10 text-slate-100 ring-1 ring-white/15'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    Preview
                  </button>
                )}
                <button
                  onClick={() => {
                    if (bottomTab === 'terminal') onTerminalClose?.()
                    else onBrowserClose?.()
                  }}
                  className="ml-auto p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
                  title="Close panel"
                >
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M1.5 1.5l9 9M10.5 1.5l-9 9"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex-1 min-h-0 relative">
                {/* Ambos ficam montados: trocar de aba não reinicia o PTY nem recarrega a página. */}
                {showTerminal && (
                  <div className={bottomTab === 'terminal' ? 'h-full' : 'hidden'}>
                    <TerminalPanel onClose={onTerminalClose || (() => {})} cwd={cwd} />
                  </div>
                )}
                {showBrowser && (
                  <div className={bottomTab === 'preview' ? 'h-full' : 'hidden'}>
                    <BrowserPreview onClose={onBrowserClose || (() => {})} />
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default IDELayout
